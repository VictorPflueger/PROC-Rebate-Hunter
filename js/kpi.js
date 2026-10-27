// Header KPI strip: rebate at risk, first claim deadline, detection → decision stopwatch, session
// cost. After a decision the first two tiles show what is still lost with the approved option, so
// the payoff of the decision is visible at a glance.

import { bus } from "./events.js";
import { h } from "./dom.js";
import { eurCompact, eurCents, clock, shortDate, int } from "./format.js";
import { STORAGE, UI } from "./config.js";

// What the stopwatch is waiting on while it runs.
const WATCH_STATE = {
  scanning: "scanning the signal",
  diagnosing: "mapping the accounts",
  verifying: "verifying the group",
  simulating: "calculating the rebate",
  options: "options ready",
  awaiting_approval: "waiting for your decision",
  executing: "drafting actions"
};

export function createKpis(container) {
  // Vici's stat card; a tile that shows a state takes that state's tone (css/style.css).
  const make = (id, label, sub) => {
    const value = h("div", { class: "vc-stat__value kpi-value", id: `kpi-${id}-value` }, "—");
    const subEl = h("div", { class: "vc-stat__note kpi-sub", id: `kpi-${id}-sub` }, sub);
    const el = h("div", { class: "vc-stat kpi", dataset: { tone: "muted" }, role: "group", "aria-label": label },
      h("div", { class: "vc-stat__label kpi-label" }, label), value, subEl);
    container.appendChild(el);
    return { el, value, sub: subEl };
  };

  const atRisk = make("var", "Rebate at risk", "lost if the deadlines pass");
  const deadline = make("deadline", "Claim deadline in", "no run yet");
  const watch = make("watch", "Detection → decision", "starts with the run");
  const cost = make("cost", "Session cost", "no model calls yet");

  let sessionBase = readSessionCost();
  let runCost = 0;
  let lastRunCost = null;
  let mode = null;
  let running = false;
  let timer = null;
  let t0 = 0;
  let frozenAt = null;
  let lastVar = null;
  let lastLabel = "";

  const set = (tile, text, tone, sub) => {
    if (tile.value.textContent !== text) {
      tile.value.textContent = text;
      tile.value.classList.remove("flip");
      void tile.value.offsetWidth;
      tile.value.classList.add("flip");
    }
    if (tone !== undefined) tile.el.dataset.tone = tone;
    if (sub !== undefined) {
      tile.sub.textContent = sub;
      tile.sub.title = sub; // full text on hover when the tile truncates it
    }
  };

  const renderCost = () => {
    if (mode === "simulation") {
      set(cost, "€0.00", "muted", "simulated: no model calls");
      return;
    }
    const total = sessionBase + runCost;
    let sub;
    if (mode === "live" && running) sub = `this run ${eurCents(runCost)}`;
    else if (lastRunCost !== null) sub = `last run ${eurCents(lastRunCost)}`;
    else sub = total > 0 ? "earlier live runs in this tab" : "no model calls yet";
    set(cost, eurCents(total), total > 0 ? "" : "muted", sub);
  };

  function startWatch() {
    stopWatch();
    t0 = performance.now();
    frozenAt = null;
    set(watch, "00:00", "", "running");
    timer = setInterval(() => {
      watch.value.textContent = clock(performance.now() - t0);
    }, 250);
  }

  function stopWatch(sub) {
    if (timer) clearInterval(timer);
    timer = null;
    if (sub && frozenAt === null) {
      frozenAt = performance.now() - t0;
      watch.value.textContent = clock(frozenAt);
      watch.sub.textContent = sub;
    }
  }

  bus.on("run_start", (ev) => {
    mode = ev.payload.mode;
    running = true;
    runCost = 0;
    lastVar = null;
    set(atRisk, "—", "muted", "calculating once the accounts are known");
    set(deadline, "—", "muted", "calculating");
    startWatch();
    renderCost();
  });

  bus.on("state_change", (ev) => {
    const label = WATCH_STATE[ev.payload.state];
    if (timer && frozenAt === null && label) watch.sub.textContent = label;
  });

  bus.on("kpi_update", (ev) => {
    const p = ev.payload;
    if (p.decided) return showDecision(p);
    if (typeof p.value_at_risk_eur === "number") {
      lastVar = p.value_at_risk_eur;
      // A what-if is shown as an assumption, never in the alarm colour of a verified loss, and a
      // first estimate is not yet a result: €0 there is not "resolved", so it is not green.
      const estimate = p.stage === "estimate";
      const tone = p.basis === "what_if" ? "at-risk" : p.value_at_risk_eur > 0 ? (estimate ? "at-risk" : "affected") : estimate ? "muted" : "resolved";
      set(atRisk, eurCompact(p.value_at_risk_eur), tone, `${p.horizon_days || 400}-day exposure${p.label ? `, ${p.label}` : ""}`);
      if (p.projected_eur > 0) atRisk.sub.title = `${atRisk.sub.textContent}; includes ${eurCompact(p.projected_eur)} projected for the current year`;
    }
    if ("first_loss_day" in p) {
      // The tile names whose claim and when, as briefly as the Navigator's "Leipzig, Mon 19 Oct":
      // "Cisco, Sun 15 Nov".
      lastLabel = p.first_loss_short || p.first_loss_label || "";
      if (p.first_loss_day === null) {
        set(deadline, "None", p.stage === "estimate" ? "muted" : "resolved", `nothing open within ${p.horizon_days || 400} days`);
      } else {
        set(deadline, dayCount(p.first_loss_day), p.first_loss_day <= UI.urgentDays ? "affected" : "at-risk",
          `${lastLabel}${lastLabel ? ", " : ""}${shortDate(p.first_loss_day)}`);
      }
    }
  });

  /** After the human decision: what is still lost with the approved option, compared with before. */
  function showDecision(p) {
    const before = typeof p.before_eur === "number" ? p.before_eur : lastVar;
    if (p.accepted) {
      atRisk.sub.textContent = "loss accepted, nothing claimed";
      deadline.sub.textContent = `${deadline.sub.textContent.replace(/, loss accepted$/, "")}, loss accepted`;
      return;
    }
    if (typeof p.residual_eur === "number") {
      set(atRisk, eurCompact(p.residual_eur), p.residual_eur > 0 ? "at-risk" : "resolved",
        `left with ${p.option_label}${typeof before === "number" ? ` (was ${eurCompact(before)})` : ""}`);
    }
    if ("first_loss_day_after" in p) {
      if (p.first_loss_day_after === null) {
        set(deadline, "None", "resolved", `nothing lost with ${p.option_label}`);
      } else {
        set(deadline, dayCount(p.first_loss_day_after), "at-risk", `${lastLabel ? `${lastLabel}, ` : ""}partial, with ${p.option_label}`);
        deadline.sub.title = `${deadline.sub.textContent}: ${shortDate(p.first_loss_day_after)}`;
      }
    }
  }

  bus.on("option_decision", (ev) => {
    if (ev.payload.decision === "approved") stopWatch("to the approved decision");
  });

  bus.on("report", () => stopWatch("to the management summary"));

  bus.on("cost_update", (ev) => {
    if (ev.payload.simulated) return;
    runCost = Number(ev.payload.eur) || 0;
    renderCost();
  });

  bus.on("run_end", (ev) => {
    const status = ev.payload.status;
    running = false;
    stopWatch(status === "done" || status === "no_findings" ? "run complete" : status === "aborted" ? "stopped (aborted)" : "stopped");
    if (mode === "live") {
      sessionBase += runCost;
      lastRunCost = runCost;
      runCost = 0;
      writeSessionCost(sessionBase);
    }
    renderCost();
  });

  function reset() {
    stopWatch();
    mode = null;
    running = false;
    runCost = 0;
    frozenAt = null;
    lastVar = null;
    set(atRisk, "—", "muted", "lost if the deadlines pass");
    set(deadline, "—", "muted", "no run yet");
    set(watch, "00:00", "muted", "starts with the run");
    renderCost();
  }

  /** Adds a cost outside a run (e.g. the optional web-search probe in Diagnostics). */
  function addSessionCost(eur) {
    sessionBase += Number(eur) || 0;
    writeSessionCost(sessionBase);
    renderCost();
  }

  reset();
  return { reset, addSessionCost };
}

function dayCount(n) {
  return `${int(n)} ${n === 1 ? "day" : "days"}`;
}

function readSessionCost() {
  try { return Number(sessionStorage.getItem(STORAGE.sessionCost)) || 0; } catch { return 0; }
}

function writeSessionCost(v) {
  try { sessionStorage.setItem(STORAGE.sessionCost, String(v)); } catch { /* ignore */ }
}
