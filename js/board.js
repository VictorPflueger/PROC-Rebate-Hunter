// The rebate board, Rebate Hunter's centrepiece (where the Navigator has its map). Two views:
//   group view      one agreement's supplier group as a constellation (the hub, the ring of linked
//                   accounts the year-end report counts, the register members outside it that it
//                   misses, look-alikes held apart) under the threshold race of its years. When the
//                   board is short (the drawer open on a decision, a small screen), the ring becomes a
//                   band under the race, and the race keeps the years with money open that fit whole;
//   portfolio view  every agreement's year due next against its tiers, and its claim deadline.
// The board listens to the run events itself: it focuses the agreement the agent works on, pulses
// the accounts a lookup is about, badges what a result confirmed, fills the race from the agent's
// sim_rebate results, colours what alerts, marks (ui_mark_board) and decisions say, and moves the
// accounts an approved option links onto the ring. A verified alert restates the agreement's
// accounts: it marks what it names and clears the earlier marks on the others. Both producers emit
// the same events, so a simulated and a live run look the same. Every figure comes from
// js/board_data.js (engine and ERP).

import { bus } from "./events.js";
import { getModel } from "./world.js";
import { h } from "./dom.js";
import { icon } from "./icons.js";
import { groupView, raceView, portfolioView, accountView, callAccounts, callAgreement, resultChecks, lookalikes, agreementOfGroup, agreementOfVendor } from "./board_data.js";
import { createRace, rowPriority, quietRow, tierMoney, BASIS_CHIP } from "./board_race.js";
import { createConstellation, constellationGeometry, BOTTOM_BAND } from "./board_group.js";
import { createBand } from "./board_band.js";
import { createPortfolio } from "./board_portfolio.js";
import { createPopover } from "./board_pop.js";
import { vendorPopover, companyCodePopover, groupPopover, counterpartyPopover, yearPopover } from "./popovers.js";

const STATES = new Set(["affected", "at_risk", "resolved", "neutral"]);

/** The race chip for an engine result: its basis, or the stage the KPI update names. */
function basisKeyOf(basis, stage) {
  if (basis === "what_if") return "what_if";
  if (basis === "partial") return "partial";
  return stage === "estimate" ? "estimate" : "verified";
}

/**
 * What an approved option does to each year with money open, from the engine's cash plan for that
 * option (the result its card was costed from): { kind, label, recovered_eur, lost_eur, via, cash_day }.
 * kind is "full" when the plan's cash covers the year's open amount, "partial" when it covers part of
 * it, "lost" when the option claims nothing for the year. A year whose deadline lies beyond the
 * result's horizon is not costed by the engine, so it stays undecided. Exported for the tests.
 */
export function decisionYears(res, variant, label) {
  const years = new Map();
  for (const y of res?.years || []) {
    if (!(y.open_eur > 0.5) || y.claim_deadline_day < 0 || y.claim_deadline_day > res.horizon_days) continue;
    const parts = (variant?.cash_in || []).filter((c) => c.year === y.year);
    const got = parts.reduce((sum, c) => sum + (Number(c.amount_eur) || 0), 0);
    const lost = Math.max(0, y.open_eur - got);
    // Each cash part is rounded to the euro: a difference within that rounding is no loss.
    const kind = got < 0.5 ? "lost" : lost > parts.length + 0.5 ? "partial" : "full";
    years.set(y.year, {
      kind, label,
      recovered_eur: Math.round(got),
      lost_eur: kind === "full" ? 0 : Math.round(lost),
      via: [...new Set(parts.map((c) => c.via).filter(Boolean))],
      cash_day: parts.length ? Math.max(...parts.map((c) => c.day)) : null
    });
  }
  return years;
}

/** "Do nothing" approved: every year with money open inside the horizon shows the loss as accepted. */
export function acceptedYears(res) {
  const years = new Map();
  for (const y of res?.years || []) {
    if (y.open_eur > 0.5 && y.claim_deadline_day >= 0 && y.claim_deadline_day <= res.horizon_days) years.set(y.year, { kind: "accepted", label: "do nothing" });
  }
  return years;
}

export function createBoard(container, { scenarios = [], initialScenario = null } = {}) {
  const model = getModel();
  const st = {
    view: "group",
    focus: null,
    entry: null,
    running: false,
    marks: new Map(),            // "vendor:ID" | "link:ID" | "group:GID" | "code:CC" | "agreement:AID" → state
    seenBy: new Map(),           // account → Set of what showed it in this run (call ids, "mark")
    calls: new Map(),            // call_id → { name, input, vendors, agreement } while a lookup runs
    checks: new Map(),           // vendor → Map(kind → Set(call_id))
    results: new Map(),          // agreement → { result, basisKey }  (the agent's latest sim_rebate)
    withVariants: new Map(),     // agreement → the latest result with costed variants
    optionsResult: null,         // the result the options on screen were costed from
    lastResultAgreement: null,
    pendingBasis: null,          // the stage a live KPI update named before its result arrived
    satellites: new Map(),       // agreement → look-alikes from the duplicate check
    moved: new Map(),            // agreement → Set(vendor ids an approved option links)
    decisions: new Map(),        // agreement → Map(year → decision)
    decisionLabel: new Map(),    // agreement → "option A" (the approved option)
    options: null,
    flagged: null,               // the agreement of the latest alert
    checkedAgreements: new Set(),
    focusHub: false,             // after a portfolio row: the keyboard focus moves to the group
    showCY: true, showLabels: true, showLinks: true
  };

  // ---- chrome: caption, view buttons, views, legend, popover ----------------------------------------
  const capTitle = h("strong", {}, "");
  const capChip = h("span", { class: "chip cap-chip", hidden: true }, "");
  const capMore = h("span", { class: "cap-more", hidden: true }, "");
  const capSub = h("span", { class: "cap-sub" }, "");
  const caption = h("div", { class: "board-caption" }, h("div", { class: "cap-line" }, capTitle, capChip, capMore), capSub);
  const btnGroup = h("button", { class: "btn btn-sm", type: "button", "aria-pressed": "true", title: "The supplier group of the agreement in focus" }, icon("target", 18), h("span", { class: "btn-text" }, "Group view"));
  const btnPortfolio = h("button", { class: "btn btn-sm", type: "button", "aria-pressed": "false", title: "Every rebate agreement, next claim deadline first" }, icon("list", 18), h("span", { class: "btn-text" }, "Portfolio view"));
  const tools = h("div", { class: "board-tools" }, btnGroup, btnPortfolio);
  btnGroup.addEventListener("click", () => showGroup());
  btnPortfolio.addEventListener("click", () => showPortfolio());

  const race = createRace({ onRow: openYear });
  const band = createBand({ onAccount: openAccount, onHub: openGroup });
  const constellation = createConstellation({ onAccount: openAccount, onHub: openGroup, onCode: openCode });
  const groupEl = h("div", { class: "board-view", dataset: { view: "group" } }, race.element, band.element, constellation.element);
  const portfolio = createPortfolio({ onRow: (id) => { pop.hide(); st.focusHub = true; focus(id); } });
  const portfolioEl = h("div", { class: "board-view", dataset: { view: "portfolio" }, hidden: true }, portfolio.element);
  const legend = buildLegend();
  container.append(caption, tools, groupEl, portfolioEl, legend);
  const pop = createPopover(container, { resolve: resolveKey });

  // ---- state helpers ----------------------------------------------------------------------------------
  const markOf = (key) => st.marks.get(key) || "neutral";
  const seenOf = (id) => (st.seenBy.get(String(id))?.size || 0) > 0;
  const checksOf = (id) => [...(st.checks.get(id)?.keys() || [])];
  const checkingVendors = () => new Set([...st.calls.values()].flatMap((c) => c.vendors));
  const checkingAgreements = () => new Set([...st.calls.values()].map((c) => c.agreement).filter(Boolean));

  function see(id, source) {
    const x = String(id);
    if (!st.seenBy.has(x)) st.seenBy.set(x, new Set());
    st.seenBy.get(x).add(source);
  }

  function mark({ vendor_ids = [], link_ids = [], group_ids = [], company_code_ids = [], agreement_ids = [], state = "affected" } = {}) {
    const s = STATES.has(state) ? state : "affected";
    const set = (key) => (s === "neutral" ? st.marks.delete(key) : st.marks.set(key, s));
    for (const id of vendor_ids || []) {
      const x = String(id);
      if (x.startsWith("G-")) set(`group:${x}`);
      else if (x.startsWith("CC-")) set(`code:${x}`);
      else if (x.startsWith("RA-")) set(`agreement:${x}`);
      else { set(`vendor:${x}`); see(x, "mark"); }
    }
    for (const id of link_ids || []) set(`link:${String(id).replace(/^L-/, "")}`);
    for (const id of group_ids || []) set(`group:${id}`);
    for (const id of company_code_ids || []) set(`code:${id}`);
    for (const id of agreement_ids || []) if (model.agreements.has(String(id))) set(`agreement:${id}`);
  }

  /** The agreement's accounts and their register links lose their marks (an alert restates them). */
  function clearAccountMarks(agreementId) {
    const gv = groupView(model, agreementId);
    for (const a of gv?.accounts || []) {
      st.marks.delete(`vendor:${a.id}`);
      st.marks.delete(`link:${a.id}`);
    }
  }

  function addCheck(vendorId, kind, callId) {
    if (!st.checks.has(vendorId)) st.checks.set(vendorId, new Map());
    const kinds = st.checks.get(vendorId);
    if (!kinds.has(kind)) kinds.set(kind, new Set());
    kinds.get(kind).add(callId);
  }

  /** Forgets everything a tool call of a discarded attempt showed: its pulse, its badges, its "seen". */
  function dropCall(callId) {
    if (st.calls.get(callId)?.name === "sim_rebate") st.pendingBasis = null;
    st.calls.delete(callId);
    for (const kinds of st.checks.values()) {
      for (const [kind, calls] of kinds) {
        calls.delete(callId);
        if (!calls.size) kinds.delete(kind);
      }
    }
    for (const sources of st.seenBy.values()) sources.delete(callId);
  }

  // ---- views ------------------------------------------------------------------------------------------
  function focus(agreementId) {
    if (!model.agreements.has(agreementId)) return;
    if (st.focus !== agreementId) pop.hide();
    st.focus = agreementId;
    st.view = "group";
    render();
  }
  function showGroup() {
    if (!st.focus) st.focus = scenarioAgreement(scenarios[0]?.id) || model.world.agreements[0].id;
    st.view = "group";
    pop.hide();
    render();
  }
  function showPortfolio() {
    if (st.view !== "portfolio") portfolio.forget();
    st.view = "portfolio";
    pop.hide();
    render();
  }
  function scenarioAgreement(id) {
    const sc = scenarios.find((s) => s.id === id);
    return sc?.agreement_id || sc?.exposure_check?.agreement_id || null;
  }
  // The board opens on the group of the scenario chosen in the control bar.
  st.focus = scenarioAgreement(initialScenario) || scenarioAgreement(scenarios[0]?.id) || model.world.agreements[0]?.id || null;

  // ---- run events ---------------------------------------------------------------------------------------
  bus.on("run_start", (ev) => {
    const p = ev.payload;
    st.running = true;
    st.entry = p.entry;
    if (p.entry === "scenario" && scenarioAgreement(p.scenario_id)) focus(scenarioAgreement(p.scenario_id));
    else showPortfolio();
  });

  bus.on("tool_call", (ev) => {
    const p = ev.payload;
    if (p.name?.startsWith("ui_") || p.name === "sim_rebate") {
      const aid = callAgreement(model, p.name, p.input || {});
      if (aid && p.name === "sim_rebate") st.calls.set(p.call_id, { name: p.name, input: p.input || {}, vendors: [], agreement: aid });
      if (aid && st.entry !== "scan") focus(aid); else render();
      return;
    }
    const vendors = callAccounts(model, p.name, p.input || {});
    const aid = callAgreement(model, p.name, p.input || {});
    st.calls.set(p.call_id, { name: p.name, input: p.input || {}, vendors, agreement: aid });
    for (const v of vendors) see(v, p.call_id);
    if (aid && st.entry !== "scan" && aid !== st.focus) focus(aid);
    else render();
  });

  bus.on("tool_result", (ev) => {
    const p = ev.payload;
    const call = st.calls.get(p.call_id) || { name: p.name, input: {}, vendors: [], agreement: null };
    st.calls.delete(p.call_id);
    const name = p.name || call.name;
    const r = p.result;
    if (p.ok !== false && r && !r.error) {
      for (const c of resultChecks(model, name, call.input, r)) addCheck(c.vendor_id, c.kind, p.call_id);
      if (name === "erp_list_vendors") for (const v of r.vendors || []) if (model.registerByVendor.has(String(v.id))) see(v.id, p.call_id);
      if (name === "erp_family_tree") for (const m of r.members || []) see(m.vendor_id, p.call_id);
      if (name === "erp_find_duplicates") {
        const pairs = lookalikes(model, r);
        const aid = pairs.length ? agreementOfVendor(model, pairs[0].probe) : null;
        if (aid) st.satellites.set(aid, pairs);
      }
      if (name === "sim_rebate" && r.ok !== false && r.agreement_id && Array.isArray(r.years)) {
        // The live agent names the stage just before the result arrives; the simulation just after.
        st.results.set(r.agreement_id, { result: r, basisKey: st.pendingBasis || basisKeyOf(r.basis, null) });
        if (r.variants?.length) st.withVariants.set(r.agreement_id, r);
        st.lastResultAgreement = r.agreement_id;
        for (const m of r.members || []) see(m.vendor_id, p.call_id);
      }
      if (name === "sim_rebate") st.pendingBasis = null;
      const aid = callAgreement(model, name, call.input, r) || call.agreement;
      if (aid) st.checkedAgreements.add(aid);
      if (aid && st.entry !== "scan" && aid !== st.focus && !name.startsWith("ui_")) { focus(aid); return; }
    }
    render();
  });

  // The KPI update that follows each calculation names its stage (first estimate, verified, what-if);
  // the one after a "do nothing" approval records the accepted loss on the open years.
  bus.on("kpi_update", (ev) => {
    const p = ev.payload;
    if (p.decided && p.accepted) { acceptLoss(); render(); return; }
    if (p.decided) return;
    const key = basisKeyOf(p.basis, p.stage);
    // A calculation still open: its result follows this update and takes the stage with it.
    if ([...st.calls.values()].some((c) => c.name === "sim_rebate")) { st.pendingBasis = key; return; }
    const rec = st.lastResultAgreement ? st.results.get(st.lastResultAgreement) : null;
    if (!rec) return;
    rec.basisKey = key;
    render();
  });

  bus.on("alert", (ev) => {
    const p = ev.payload;
    const aid = (p.group_ids || []).map((g) => agreementOfGroup(model, g)).find(Boolean) || (p.vendor_ids || []).map((v) => agreementOfVendor(model, v)).find(Boolean);
    // The alert states the finding: the agreement's accounts show what it names, and nothing older
    // (an account the report counts no longer reads "at risk" from the opening of the run).
    if (aid) { clearAccountMarks(aid); st.flagged = aid; }
    mark({ vendor_ids: p.vendor_ids || [], link_ids: p.link_ids || [], group_ids: p.group_ids || [], state: p.basis === "what_if" ? "at_risk" : "affected" });
    if (aid && (st.entry === "scan" || st.view === "portfolio" || aid !== st.focus)) focus(aid); else render();
  });

  bus.on("board_update", (ev) => {
    const p = ev.payload;
    mark(p);
    if (p.source === "decision") applyDecision(p);
    if (p.focus && model.agreements.has(p.focus)) focus(p.focus);
    else if (p.view === "portfolio") showPortfolio();
    else render();
  });

  bus.on("options", (ev) => {
    const p = ev.payload;
    st.options = p;
    // The cards are costed from the latest result with variants; a later calculation (after a
    // rejection, say) does not change what an approval of these cards means.
    st.optionsResult = p.agreement_id ? (st.withVariants.get(p.agreement_id) || st.results.get(p.agreement_id)?.result || null) : null;
    if (p.agreement_id && p.agreement_id !== st.focus) focus(p.agreement_id); else render();
  });

  bus.on("attempt_discarded", (ev) => {
    for (const id of ev.payload.call_ids || []) dropCall(id);
    render();
  });

  bus.on("run_end", () => {
    st.running = false;
    st.calls.clear();
    render();
  });

  /**
   * The result the race shows for an agreement: once an option is approved, the one the decision was
   * taken on (a later recount must not mix its figures with the decision's); else the latest.
   */
  function resultFor(aid) {
    if (st.decisions.has(aid) && st.optionsResult?.agreement_id === aid) return st.optionsResult;
    return st.results.get(aid)?.result || null;
  }

  /** The result the options on screen were costed from (for their agreement). */
  function optionsResultFor(aid) {
    const r = st.optionsResult;
    return r && r.agreement_id === aid ? r : st.withVariants.get(aid) || null;
  }

  /** An approved option: the accounts it links move onto the ring; each year shows what it claims. */
  function applyDecision(p) {
    const opts = st.options;
    if (!opts || !p.option_id || p.option_id === "baseline") return;
    const aid = opts.agreement_id;
    const opt = (opts.options || []).find((o) => o.id === p.option_id);
    if (!aid || !opt) return;
    const label = `option ${opt.letter}`;
    st.decisionLabel.set(aid, label);
    const moved = st.moved.get(aid) || new Set();
    for (const id of p.linked_vendor_ids || opt.linked_vendor_ids || []) moved.add(String(id));
    st.moved.set(aid, moved);
    const res = optionsResultFor(aid);
    const v = res?.variants?.find((x) => x.variant_id === p.option_id);
    if (res && v) st.decisions.set(aid, decisionYears(res, v, label));
  }

  /** "Do nothing" approved: every open year of the agreement shows the loss as accepted. */
  function acceptLoss() {
    const aid = st.options?.agreement_id;
    const res = aid ? optionsResultFor(aid) || st.results.get(aid)?.result : null;
    if (res) st.decisions.set(aid, acceptedYears(res));
  }

  // ---- popovers -------------------------------------------------------------------------------------------
  function placeText(id) {
    const a = model.agreements.get(st.focus);
    if (!a) return null;
    const sat = (st.satellites.get(a.id) || []).find((s) => s.vendor_id === id);
    if (sat) return `Look-alike of ${sat.probe} (${Math.round(sat.similarity_pct)} % similar name); ${sat.verdict}. Names never merge accounts.`;
    if (a.linked.includes(id)) {
      const cur = a.report?.currencies;
      const v = model.vendors.get(id);
      if (cur && !cur.includes(v.currency)) return `Linked to ${a.id}, but the year-end report counts ${cur.join(", ")} invoices only.`;
      const note = reportNoteOf(currentRace);
      return note ? `Linked to ${a.id}, but ${note}.` : `Linked to ${a.id}, so the year-end report counts it.`;
    }
    const decided = st.decisionLabel.get(a.id);
    if (st.moved.get(a.id)?.has(id)) return `To be linked to ${a.id} with ${decided || "the approved option"} (a master-data request in the Outbox).`;
    const claimed = decided && markOf(`vendor:${id}`) === "resolved" ? ` The claim in ${decided} counts its invoices; the account stays unlinked.` : "";
    return `Not linked to ${a.id}: the register lists it in the group, but the year-end report misses it.${claimed}`;
  }
  function openAccount(id, anchor) {
    pop.show(anchor, vendorPopover(model, id, markOf(`vendor:${id}`), { placeText: placeText(id), checks: checksOf(id) }), { label: `Account ${id}`, id: `vendor:${id}` });
  }
  function openGroup(anchor) {
    const a = model.agreements.get(st.focus);
    if (!a) return;
    const content = a.group ? groupPopover(model, a.group, markOf(`group:${a.group}`)) : counterpartyPopover(model, a.id);
    pop.show(anchor, content, { label: a.group ? model.groups.get(a.group)?.name : a.counterparty, id: `group:${a.group || a.id}` });
  }
  function openCode(id, anchor) {
    pop.show(anchor, companyCodePopover(model, id, markOf(`code:${id}`)), { label: `Company code ${id}`, id: `code:${id}` });
  }
  function openYear(row, anchor) {
    const view = currentRace;
    if (!view) return;
    const decision = st.decisions.get(view.agreement.id)?.get(row.year) || null;
    pop.show(anchor, yearPopover(model, view, row, decision), {
      label: `${row.label} of ${view.agreement.id}`, id: `year:${view.agreement.id}:${row.year}`,
      placement: "below", placeAt: race.element, tipAt: anchor.querySelector(".race-out") || anchor
    });
  }

  /** The element that stands for a popover's key now (the board may have redrawn it). */
  function resolveKey(key) {
    const [kind, a, b] = String(key).split(":");
    const compact = !band.element.hidden;
    if (kind === "vendor") return compact ? band.button(a) : constellation.nodeButton(a);
    if (kind === "code") return compact ? null : constellation.codeButton(a);
    if (kind === "group") return compact ? band.hub : constellation.hub;
    if (kind === "year") return currentRace?.agreement.id === a ? race.rowButton(b) : null;
    return null;
  }

  // ---- drawing ----------------------------------------------------------------------------------------------
  let frame = null;
  let currentRace = null;
  function render() {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = null; draw(); });
  }

  function draw() {
    container.dataset.view = st.view;
    btnGroup.setAttribute("aria-pressed", String(st.view === "group"));
    btnPortfolio.setAttribute("aria-pressed", String(st.view === "portfolio"));
    container.style.setProperty("--tools-w", `${Math.round(tools.offsetWidth || 340)}px`);
    for (const g of legend.querySelectorAll("[data-only]")) g.hidden = g.dataset.only !== st.view;
    if (st.view === "group" && st.focus) drawGroup();
    else drawPortfolio();
    if (st.focusHub) {
      st.focusHub = false;
      if (st.view === "group") (band.element.hidden ? constellation.hub : band.hub).focus({ preventScroll: true });
    }
  }

  function setCaption(title, sub, chipKey) {
    capTitle.textContent = title;
    capSub.textContent = sub;
    const [label, tone] = chipKey ? BASIS_CHIP[chipKey] || BASIS_CHIP.report : [null, null];
    capChip.hidden = !label;
    capChip.textContent = label || "";
    if (tone) capChip.dataset.tone = tone; else delete capChip.dataset.tone;
    setCaptionMore(0);
  }

  /** The race's note of the years it leaves out, in the caption (a short board hides the race's head). */
  function setCaptionMore(n) {
    capMore.hidden = !n;
    capMore.textContent = n ? `+${n} year${n === 1 ? "" : "s"} not shown` : "";
  }

  /** Why the report missed the rebate of the linked accounts, when its listing minimum is the cause. */
  function reportNoteOf(view) {
    const min = view?.agreement.report_min_eur || 0;
    const ay = view?.rows.find((r) => r.year === "AY");
    return min > 0 && ay && ay.counted_eur < min ? `the report lists ${view.agreement.short} only from ${tierMoney(min)}` : null;
  }

  function drawGroup() {
    groupEl.hidden = false;
    portfolioEl.hidden = true;
    const aid = st.focus;
    const gv = groupView(model, aid);
    const rec = st.results.get(aid) || null;
    const view = raceView(model, aid, resultFor(aid));
    currentRace = view;
    const basisKey = rec ? rec.basisKey : "report";
    setCaption(gv.hub.label, `${gv.agreement.id} · ${gv.agreement.title}: ${gv.agreement.tiers_text}`, basisKey);
    const decisions = st.decisions.get(aid) || new Map();
    race.element.style.maxHeight = "";
    race.render(view, { basisKey, decisions, showCY: st.showCY });
    const ctx = {
      gv, view, decisions,
      moved: st.moved.get(aid) || new Set(),
      decisionLabel: st.decisionLabel.get(aid) || null,
      reportNote: reportNoteOf(view),
      hubKey: gv.group ? `group:${gv.group.id}` : `agreement:${aid}`
    };
    // The constellation takes what the race leaves. Before that, years with no rebate either way
    // (and no decision) give their room to the group, while the closed year always stays.
    const height = groupEl.clientHeight;
    let room = height - race.element.offsetHeight - 8;
    if (room < 260) {
      const years = view.rows.filter((r) => st.showCY || r.year !== "CY");
      const kept = years.filter((r) => r.year === "AY" || !quietRow(r) || decisions.has(r.year));
      if (kept.length && kept.length < years.length) {
        race.setOnly(new Set(kept.map((r) => r.year)));
        room = height - race.element.offsetHeight - 8;
      }
    }
    // Too little room for the labels (about 38 px for each account on the busier side), or a ring
    // and labels that cannot be placed without overlapping: the band replaces the constellation.
    const linkedCount = gv.accounts.filter((a) => a.linked).length;
    const crowd = Math.max(linkedCount, gv.accounts.length - linkedCount);
    if (room >= Math.max(150, 76 + crowd * 38) && drawConstellation(ctx, room)) {
      setCaptionMore(race.hiddenCount());
      return;
    }
    drawBand(ctx, height);
    setCaptionMore(race.hiddenCount());
  }

  /** The constellation under the race; false when its ring and labels do not fit the room. */
  function drawConstellation({ gv, moved, decisionLabel, reportNote }, room) {
    band.hide();
    constellation.element.hidden = false;
    constellation.element.style.setProperty("--race-h", `${race.element.offsetTop + race.element.offsetHeight + 8}px`);
    const agreement = model.agreements.get(st.focus);
    const sats = (st.satellites.get(st.focus) || []).map((s) => ({ ...s, ...accountView(model, agreement, s.vendor_id), vendor_id: s.vendor_id }));
    constellation.render(gv, {
      stateOf: markOf, seenOf, checksOf, checking: checkingVendors(), moved,
      satellites: sats, showLabels: st.showLabels, showLinks: st.showLinks, decisionLabel, reportNote
    });
    fitLegend(room, { fitsBeside: legendFitsBeside(gv, room) });
    const expanded = legend.dataset.collapsed !== "true";
    const placed = constellation.layout({ animate: true, insetLeft: expanded ? legend.offsetWidth + 12 : 0, narrow: container.dataset.w === "narrow", obstacles: legendBox() });
    return placed?.fits !== false;
  }

  /**
   * The band under the race (a short board, or a group too crowded for its room): every year that
   * fits whole, the years with money open first, and the accounts' spend in the year the race leads
   * with.
   */
  function drawBand({ gv, view, decisions, moved, decisionLabel, reportNote, hubKey }, height) {
    constellation.element.hidden = true;
    race.element.style.maxHeight = "";
    race.setOnly(null);
    // The race keeps rows in their order of priority, so it always leads with the first of them.
    const lead = rowPriority(view.rows.filter((r) => st.showCY || r.year !== "CY"), decisions)[0]?.year;
    band.render(gv, { stateOf: markOf, hubKey, moved, decisionLabel, seenOf, checking: checkingVendors(), reportNote, spendYear: lead === "PY" ? "PY" : "AY" });
    fitRace(view, decisions, height - band.element.offsetHeight - 8);
    const free = height - race.element.offsetHeight - band.element.offsetHeight - 16;
    fitLegend(0, { compact: true, free });
  }

  /**
   * A short board keeps the race rows that fit whole above the band: years with money open (or a
   * decision) first, the nearest deadline first, then the closed year, the current year and the
   * look-back year. Never a row cut in half; at least one row (which scrolls in the card if it must).
   */
  function fitRace(view, decisions, avail) {
    if (race.element.offsetHeight <= avail) return;
    const heights = race.rowHeights();
    const chrome = race.element.offsetHeight - [...heights.values()].reduce((sum, x) => sum + x, 0);
    const keep = new Set();
    let used = chrome;
    for (const r of rowPriority(view.rows.filter((x) => heights.has(x.year)), decisions)) {
      const x = heights.get(r.year);
      if (keep.size && used + x > avail) break;
      keep.add(r.year);
      used += x;
    }
    race.setOnly(keep);
    race.element.style.maxHeight = `${Math.max(48, Math.floor(avail))}px`;
  }

  function drawPortfolio() {
    groupEl.hidden = true;
    portfolioEl.hidden = false;
    currentRace = null;
    const results = new Map([...st.results.keys()].map((k) => [k, resultFor(k)]));
    const rows = portfolioView(model, results);
    setCaption(`${model.world.meta.company}: ${rows.length} rebate agreements`,
      st.entry === "scan" && (st.running || st.checkedAgreements.size)
        ? `Live sweep: ${st.checkedAgreements.size} of ${rows.length} checked · next claim deadline first`
        : st.results.size
          ? "The agent's count where it has one, else the year-end report · next claim deadline first"
          : "What the year-end report counted · next claim deadline first",
      null);
    const squeezed = fitLegend(0);
    const checking = checkingAgreements();
    portfolio.render(rows, {
      stateOf: markOf, checking, checked: st.checkedAgreements, focus: st.focus,
      decisionOf: (id, year) => st.decisions.get(id)?.get(year) || null,
      basisOf: (id) => st.results.get(id)?.basisKey || null
    });
    portfolio.element.style.setProperty("--legend-room", squeezed ? "12px" : legend.dataset.collapsed === "true" ? "64px" : `${Math.min(legend.offsetHeight + 24, 320)}px`);
    // The row the run is about stays in view: the one being checked, else the one a finding flags.
    portfolio.reveal([...checking][0] || st.flagged || st.focus);
  }

  /**
   * Whether the open legend leaves the constellation room for its labels (the board's width, the
   * accounts of the group in focus).
   */
  function legendFitsBeside(gv, room) {
    const moved = st.moved.get(st.focus) || new Set();
    const ids = (pick) => gv.accounts.filter(pick).map((a) => a.id);
    const g = constellationGeometry({
      width: groupEl.clientWidth, height: room - BOTTOM_BAND, narrow: container.dataset.w === "narrow",
      ring: ids((a) => a.linked), moved: ids((a) => !a.linked && moved.has(a.id)), outer: ids((a) => !a.linked && !moved.has(a.id)),
      satellites: st.satellites.get(st.focus) || [], insetLeft: (legend.offsetWidth || 272) + 12
    });
    return g.fits;
  }

  /** The legend's box in the constellation's coordinates, for the labels to keep clear of. */
  function legendBox() {
    if (legend.dataset.squeezed === "true") return [];
    const lb = legend.getBoundingClientRect();
    if (!lb.width) return [];
    const cb = constellation.element.getBoundingClientRect();
    return [{ x0: lb.left - cb.left - 8, x1: lb.right - cb.left + 8, y0: lb.top - cb.top - 8, y1: lb.bottom - cb.top + 8 }];
  }

  /**
   * The legend never covers the race or the accounts. In the group view it stays in the
   * constellation's area below the race and folds away when that area is short or too narrow for it
   * beside the group; the labels keep clear of its folded bar. Under the band it shows when there is
   * room for it there (folded, unless the presenter opened it). In the portfolio it folds away, so
   * the rows stay in view. When there is no room even for the folded bar, it steps aside. Returns
   * whether it is squeezed out.
   */
  function fitLegend(room, { compact = false, free = 0, fitsBeside = true } = {}) {
    let squeeze = false;
    if (st.view !== "group") {
      squeeze = container.clientHeight < 420;
      legend.style.maxHeight = "";
      legend.autoFit(true);
    } else if (compact) {
      squeeze = free < 56;
      legend.style.maxHeight = `${Math.max(44, Math.floor(free - 12))}px`;
      legend.autoFit(true);
    } else {
      // Open only when the whole card fits below the race (no entry cut by a scroll) and beside the group.
      legend.style.maxHeight = `${Math.max(44, room - 20)}px`;
      legend.autoFit(room < legendFullHeight() + 24 || container.clientHeight < 620 || !fitsBeside);
    }
    legend.dataset.squeezed = String(squeeze);
    return squeeze;
  }

  /** The open legend's full height (measured while it is open, else the last measure). */
  let legendFull = 0;
  function legendFullHeight() {
    if (legend.dataset.collapsed !== "true" && legend.offsetHeight) {
      const head = legend.querySelector(".legend-head");
      const body = legend.querySelector(".legend-body");
      legendFull = (head?.offsetHeight || 40) + (body?.scrollHeight || 0) + 2;
    }
    return legendFull || 440;
  }

  // ---- sizes ---------------------------------------------------------------------------------------------
  const sizeClass = () => {
    const hgt = container.clientHeight;
    const wid = container.clientWidth;
    container.dataset.h = hgt >= 520 ? "tall" : hgt >= 340 ? "mid" : "short";
    container.dataset.w = wid < 820 ? "narrow" : "wide";
    container.dataset.tools = wid < 640 ? "icons" : "text";
  };
  if (typeof ResizeObserver === "function") {
    new ResizeObserver(() => { sizeClass(); render(); }).observe(container);
  }
  sizeClass();
  render();

  // ---- legend --------------------------------------------------------------------------------------------
  function buildLegend() {
    const toggle = (label, key, title) => {
      const btn = h("button", { class: "legend-chip", type: "button", "aria-pressed": String(st[key]), title }, h("span", { class: "box" }, icon("check", 12)), label);
      btn.addEventListener("click", () => {
        st[key] = !st[key];
        btn.setAttribute("aria-pressed", String(st[key]));
        render();
      });
      return btn;
    };
    const dot = (cls, fill, stroke, label) => h("div", { class: "legend-row" }, h("span", { class: `legend-swatch-dot ${cls}`, style: { background: fill, borderColor: stroke } }), label);
    const line = (cls, label) => h("div", { class: "legend-row" }, h("span", { class: `legend-swatch-line ${cls}`, style: { borderTopColor: cls === "dotted" ? "var(--slate-9)" : "var(--network)" } }), label);
    const el = h("section", { class: "legend", "aria-label": "Board legend", dataset: { collapsed: "false" } });
    const collapseBtn = h("button", { class: "btn btn-ghost btn-icon", type: "button", "aria-label": "Collapse legend", "aria-expanded": "true", title: "Collapse legend" }, icon("chevronDown", 18));
    const setCollapsed = (collapsed) => {
      el.dataset.collapsed = String(collapsed);
      collapseBtn.replaceChildren(icon(collapsed ? "chevronUp" : "chevronDown", 18));
      collapseBtn.setAttribute("aria-expanded", String(!collapsed));
      collapseBtn.setAttribute("aria-label", collapsed ? "Expand legend" : "Collapse legend");
      collapseBtn.title = collapsed ? "Expand legend" : "Collapse legend";
      render();
    };
    let userChoice = false;
    collapseBtn.addEventListener("click", () => { userChoice = true; setCollapsed(el.dataset.collapsed !== "true"); });
    // While the presenter has not chosen, the board decides (see fitLegend).
    el.autoFit = (collapse) => {
      if (userChoice) return;
      if (collapse !== (el.dataset.collapsed === "true")) setCollapsed(collapse);
    };
    el.append(
      h("div", { class: "legend-head" }, h("strong", {}, "Legend"), collapseBtn),
      h("div", { class: "legend-body" },
        h("div", { class: "legend-toggles", role: "group", "aria-label": "Show on the board", dataset: { only: "group" } },
          toggle("Register links", "showLinks", "The register's links from the group to its accounts"),
          toggle("Labels", "showLabels", "The accounts' names and what the report does with them"),
          toggle("Current year", "showCY", "The current agreement year in the race, projected")),
        h("div", { class: "legend-group", dataset: { only: "group" } }, h("h4", {}, "Accounts (size: closed-year spend)"),
          dot("", "var(--slate-4)", "var(--slate-9)", "Linked: the report counts it"),
          dot("dashed", "var(--paper)", "var(--slate-9)", "Not linked: the report misses it"),
          line("", "Register link"),
          line("dashed", "Register link, acquired"),
          line("dotted", "Look-alike: no merge")),
        h("div", { class: "legend-group" }, h("h4", {}, "Status"),
          dot("", "var(--affected-fill)", "var(--affected)", "Rebate missed"),
          dot("", "var(--at-risk-fill)", "var(--at-risk)", "At risk"),
          dot("", "var(--resolved-fill)", "var(--resolved)", "Approved or settled"),
          dot("pulse", "", "", "Being checked by the agent"))
      )
    );
    return el;
  }

  // ---- API ---------------------------------------------------------------------------------------------------
  /** Clears the run's marks, checks and results (the view stays; ui.js chooses what to show next). */
  function reset() {
    st.marks.clear();
    st.seenBy.clear();
    st.calls.clear();
    st.checks.clear();
    st.results.clear();
    st.withVariants.clear();
    st.optionsResult = null;
    st.lastResultAgreement = null;
    st.pendingBasis = null;
    st.satellites.clear();
    st.moved.clear();
    st.decisions.clear();
    st.decisionLabel.clear();
    st.options = null;
    st.flagged = null;
    st.checkedAgreements.clear();
    st.running = false;
    st.entry = null;
    pop.hide();
    render();
  }

  return {
    ready: true,
    focusAgreement: (id) => focus(id),
    focusScenario: (id) => { const aid = scenarioAgreement(id); if (aid) focus(aid); },
    showGroup, showPortfolio, reset,
    invalidate: () => { sizeClass(); render(); }
  };
}
