// Starts Rebate Hunter: the presenter's shell (js/shell.js, Navigator's) around one case at a time. The
// simulation plays the case's script at once through the agent's own tools (js/simulation.js at full
// speed); Start agent offers it again or a live run with Claude on the visitor's key (js/live.js, loaded
// on demand). Both emit the same events, which js/run.js digests, js/story.js words and js/view.js draws.
//
// Play walks the five steps by itself, each for as long as its title and lead take to read, and holds
// wherever the person acts: the bar under the story then says "Your turn" and holds the one action,
// with Vici's vc-attention. An approval goes on to the drafts. Keys: Space plays or pauses; the arrow
// keys, a clicker's PageDown and PageUp, 1 to 5 and Home step by hand and pause Play. Links:
// ?case=microsoft-look-back&step=calculate opens a step, paused.

import { createShell, getParam, setParam } from "./shell.js";
import { bus, newRunId } from "./events.js";
import { createSimulationPlayer } from "./simulation.js";
import { getModel } from "./world.js";
import { digest, STEP_IDS } from "./run.js";
import { story, STEPS, caseList, slugOf } from "./story.js";
import { renderStep } from "./view.js";
import { cents, eur, eurSpend, count } from "./plain.js";
import { MODELS, DEFAULT_MODEL, UI } from "./config.js";

const $ = (id) => document.getElementById(id);
const MODEL_LABEL = MODELS.find((m) => m.id === DEFAULT_MODEL)?.label || DEFAULT_MODEL;
const NUDGE_MS = 6000;
const BEAT_MS = 900;

try {
  start();
} catch (err) {
  console.error("[Rebate Hunter] start-up failed:", err);
  $("boot").dataset.state = "failed";
  $("boot-status").textContent = "Rebate Hunter could not start.";
  $("boot-detail").textContent = String(err?.message || err);
  $("boot-detail").hidden = false;
}

function start() {
  for (const name of ["WORLD", "SCENARIOS", "REFERENCE_CASES", "SIM_RUNS"]) {
    if (!globalThis[name]) throw new Error(`A data file did not load (${name}). Deploy data/ next to index.html and reload.`);
  }
  const CASES = window.SCENARIOS;
  const SCRIPTS = window.SIM_RUNS;
  const model = getModel();
  const player = createSimulationPlayer({ getSpeed: () => Infinity });
  const guide = $("guide");
  const S = { scenario: null, mode: "simulation", runId: null, events: [], view: null, run: null, step: 0, live: null, follow: true, frame: 0, beat: 0, clockOn: false };
  /** Play: on, the frame it asked for, the time spent reading the step, the step it timed. */
  const P = { on: false, raf: 0, at: 0, last: 0, step: -1 };
  const estimates = new Map();

  const shell = createShell({
    steps: STEPS,
    onStep(id, how) {
      if (how !== "play") pause();
      S.step = STEP_IDS.indexOf(id);
      if (S.mode === "live") S.follow = S.step >= (S.run?.reached ?? 0);
      if (P.step !== S.step) Object.assign(P, { step: S.step, at: 0 });
      render();
      const shown = S.view.steps[S.step];
      if (how !== "code") shell.announce(`Step ${S.step + 1} of 5, ${shown.label}: ${shown.title}.${shown.turn ? ` Your turn: ${shown.turn}` : ""}`);
      if (how !== "code" && how !== "play") $("story-title").focus({ preventScroll: true });
      quiet();
    },
    onForward: () => goStep(S.step + 1, "key"),
    onSpace: () => (P.on ? pause() : play()),
    onStart: (mode) => (mode === "live" ? startLive() : (openCase(S.scenario), play())),
    onRestart: () => { openCase(S.scenario); play(); },
    onCase: (slug) => { openCase(CASES.find((c) => slugOf(c) === slug) || CASES[0]); play(); }
  });

  // Detection → decision: from the tip on screen (the guide closed) to the person's approval.
  const clock = shell.createClock((text) => shell.setKpi("Detection → decision", {
    value: text.replace(/^0(\d:)/, "$1"),
    note: !S.clockOn ? "starts with the tip" : S.view?.kpis.clockNote || "running since the tip",
    tone: S.run?.decision ? "decided" : ""
  }));
  const startClock = () => { if (S.clockOn || guide.open) return; S.clockOn = true; clock.start(); };

  // ---- a case ---------------------------------------------------------------------------------------
  function openCase(scenario) {
    stopRun();
    S.scenario = scenario;
    S.mode = "simulation";
    S.events = [];
    S.follow = true;
    clearTimeout(S.beat);
    shell.setMode("simulation");
    shell.setCases(caseList(CASES), slugOf(scenario));
    setParam("case", scenario.id === UI.defaultScenario ? null : slugOf(scenario));
    S.runId = newRunId();
    bus.beginRun({ run_id: S.runId, mode: "simulation" });
    bus.emit("run_start", { run_id: S.runId, mode: "simulation", entry: "scenario", scenario_id: scenario.id, title: scenario.title, seed: scenario.seed, sim_source: SCRIPTS[scenario.id].source || "authored" });
    player.play(SCRIPTS[scenario.id], { scenario: scenario.id });
    clock.reset();
    S.clockOn = false;
    startClock();
    Object.assign(P, { step: 0, at: 0 });
    S.step = 0;
    render();
    shell.go(STEP_IDS[0], "code");
    $("agent-note").textContent = "replayed, not live";
  }

  function stopRun() {
    if (player.isActive()) player.abort("Another case was opened.");
    if (S.live?.isActive()) S.live.abort("Back to the simulation.");
    S.live = null;
    bus.endRun();
  }

  bus.onAny((ev) => {
    if (!ev.run_id || ev.run_id !== S.runId) return;
    S.events.push(ev);
    if (ev.type === "option_decision" && ev.payload.decision === "approved") clock.stop();
    schedule();
  });

  /** Resolves once the run waits for the person or has ended, so the first screen shows every figure. */
  const rested = (limit = 10000) => new Promise((resolve) => {
    const t0 = Date.now();
    const check = () => {
      const r = digest(S.events);
      if (r.options || r.end || Date.now() - t0 > limit) resolve(); else setTimeout(check, 20);
    };
    check();
  });

  function schedule() {
    if (S.frame) return;
    S.frame = requestAnimationFrame(() => { S.frame = 0; render(); });
  }

  // ---- drawing --------------------------------------------------------------------------------------
  function render() {
    const run = digest(S.events);
    const view = story({ model, scenario: S.scenario, run, mode: S.mode });
    const was = S.run;
    S.run = run;
    S.view = view;
    const last = view.steps.findLastIndex((s) => s.ready);
    shell.setReached(STEP_IDS[Math.max(0, last)]);
    // A live run: the page follows the agent's step until the presenter looks back (onStep draws it).
    if (S.mode === "live" && S.follow && S.step < run.reached && run.reached <= last) { shell.go(STEP_IDS[run.reached], "code"); return; }
    view.steps.forEach((st) => { const li = document.querySelector(`#steps [data-step="${st.id}"]`); li.dataset.waits = String(!!st.waits); });
    const step = view.steps[S.step];
    renderStep(step, { mode: S.mode, act: { decide, decideDraft }, log: view.log });
    kpis(view, run);
    drawPlay();
    drawMove();
    document.body.dataset.step = step.id;
    // An approval goes on to the drafts after a beat, so the room sees the figures move first.
    if (run.decision && !was?.decision && S.step === 3 && S.mode !== "live") {
      clearTimeout(S.beat);
      S.beat = setTimeout(() => { if (S.step === 3) goStep(4, "play"); }, BEAT_MS);
    }
  }

  function kpis(view, run) {
    const k = view.kpis;
    for (const [name, v] of [["Rebate at stake", k.stake], ["Claim deadline", k.deadline]]) {
      if (v) shell.setKpi(name, { value: v.value, was: v.was || undefined, note: v.note, tone: v.tone || "" });
    }
    shell.setKpi("Detection → decision", { note: !S.clockOn ? "starts with the tip" : k.clockNote, tone: run.decision ? "decided" : "" });
    if (S.mode === "live") {
      shell.setKpi("Session cost", { value: cents(run.cost?.eur || 0), note: `measured, ${MODEL_LABEL}`, tone: "" });
    } else {
      // The page is written with the lead case's estimate; another case waits for its own.
      const e = estimates.get(S.scenario.id);
      if (e) shell.setKpi("Session cost", { value: `≈\u00a0${cents(e.eur)}`, note: "estimated for a live run", tone: "" });
      else if (S.scenario.id !== UI.defaultScenario) shell.setKpi("Session cost", { value: "…", note: "estimated for a live run", tone: "" });
    }
  }

  // ---- the bar that asks ------------------------------------------------------------------------------
  /** What the bar under the story says and offers; the one action the page waits for draws the eye. */
  function moveFor() {
    const v = S.view;
    const run = S.run;
    const here = v.steps[S.step];
    const next = v.steps[S.step + 1];
    const live = S.mode === "live";
    const goTo = (i, label, extra = {}) => ({ id: "go", label, icon: i < S.step ? "chevron-left" : "chevron-right", onClick: () => goStep(i, "click"), ...extra });
    if (live && !run.end) {
      const wait = v.steps.findIndex((s) => s.waits);
      if (wait >= 0 && wait !== S.step) return { tone: "move", lead: "Your turn.", text: `Claude waits for your ${wait === 3 ? "decision" : "approval"} in step ${wait + 1}.`, actions: [goTo(wait, `Go to step ${wait + 1}`, { attention: "now" })] };
      if (wait < 0) {
        const now = STEPS[Math.min(run.reached, 4)];
        return { tone: "working", lead: "Claude is working.", text: `Step ${STEPS.indexOf(now) + 1}, ${now.label}: ${now.doing}. You are interacting with an AI system.`, actions: [{ id: "stop", label: "Stop the live run", icon: "stop", kind: "danger", onClick: () => S.live?.abort("You stopped the live run.") }] };
      }
    }
    if (live && run.end && !here.waits) {
      const ok = ["done", "no_findings"].includes(run.end.status);
      return { tone: "done", lead: ok ? "Done." : "The live run stopped.", text: ok ? "Nothing was sent. Replay shows the simulation again." : `${v.ended?.text || "It ended early."} Start agent runs it again; Replay shows the simulation.`,
        actions: [{ id: "replay", label: "Replay the simulation", icon: "refresh", kind: "secondary", onClick: () => { openCase(S.scenario); play(); } }] };
    }
    if (!run.options && !run.end && !live && S.events.length < 5) return { tone: "working", lead: "Starting.", text: "The agent reads the tip.", actions: [] };
    if (here.waits && here.id === "propose") {
      const open = (run.options?.options || []).filter((o) => !run.rejected.includes(o.id));
      const pick = open.find((o) => o.recommended) || open.slice().sort((p, q) => p.total_cost_eur - q.total_cost_eur)[0] || null;
      return { tone: "move", lead: "Your turn.", text: here.turn, actions: [pick
        ? { id: "approve-option", label: `Approve option ${pick.letter}`, icon: "check", attention: "now", onClick: () => decide(pick.id, "approved") }
        : { id: "accept-loss", label: "Accept the loss", icon: "check", attention: "now", onClick: () => decide("baseline", "approved") }] };
    }
    if (here.waits && here.id === "prepare") {
      const drafts = run.drafts;
      const open = drafts.filter((d) => (d.status || "pending") === "pending").length;
      const label = open === drafts.length ? (open === 2 ? "Approve both" : open === 1 ? "Approve the draft" : "Approve all") : `Approve the other ${count(open)}`;
      return { tone: "move", lead: "Your turn.", text: here.turn, actions: [{ id: "approve-all", label, icon: "check", attention: "now", onClick: approveAll }] };
    }
    if (here.id === "prepare" && !run.decision) {
      return { tone: "move", lead: "Your turn.", text: "The agent drafts only for an option you approve. Decide in step 4 first.", actions: [goTo(3, "Back to step 4: Propose", { attention: "now" })] };
    }
    if (next && next.ready) {
      const text = `Next, step ${S.step + 2}: ${next.next}.`;
      return P.on
        ? { tone: "play", lead: "Playing.", text, actions: [goTo(S.step + 1, `Next: ${next.label}`)] }
        : { tone: "move", lead: "Your turn.", text: `${text} Or press Play.`, actions: [goTo(S.step + 1, `Next: ${next.label}`, { attention: "nudge" })] };
    }
    if (!next || here.id === "prepare") {
      const elapsed = run.decision ? document.querySelector('[data-vc-kpi="Detection → decision"] .kpi-value')?.textContent.trim() || "" : "";
      const accepted = run.decision?.option_id === "baseline";
      return { tone: "done", lead: "Done.", text: `${elapsed ? `Tip to decision in ${elapsed}. ` : ""}${accepted ? "You accepted the loss; nothing goes to the supplier." : "Nothing was sent."}`,
        actions: [{ id: "replay", label: "Replay", icon: "refresh", kind: "secondary", onClick: () => { openCase(S.scenario); play(); } }, { id: "cases", label: "Another case", icon: "chevron-down", kind: "ghost", onClick: () => shell.openCases() }] };
    }
    return { tone: "working", lead: "The agent is working.", text: `Step ${S.step + 2}, ${next.label}, opens when it is ready.`, actions: [] };
  }

  /** The bar, through the shell; then Vici's vc-attention on the action the page waits for: at once where
   * the person decides or approves, after six quiet seconds where Next is all that is left. */
  let idle = 0;
  function drawMove() {
    const m = moveFor();
    shell.setMove({ ...m, actions: m.actions.map((a) => ({ ...a, attention: !!a.attention })) });
    $("move-fill").hidden = !(m.tone === "play" && P.on);
    const want = m.actions.find((a) => a.attention);
    const button = document.querySelector("#move [data-attention]");
    if (!button || !want) return;
    if (want.attention === "now") button.classList.add("vc-attention");
    else if (!button.classList.contains("vc-attention") && !idle) {
      idle = setTimeout(() => { idle = 0; if (!P.on && !covered()) document.querySelector("#move [data-attention]")?.classList.add("vc-attention"); }, NUDGE_MS);
    }
  }
  /** A click, a key or a scroll starts the six seconds again. */
  function quiet() {
    clearTimeout(idle);
    idle = 0;
    if (moveFor().actions.find((a) => a.attention)?.attention === "nudge") document.querySelector("#move [data-attention]")?.classList.remove("vc-attention");
    drawMove();
  }
  for (const t of ["pointerdown", "keydown", "wheel"]) document.addEventListener(t, () => { if (!P.on && S.view) requestAnimationFrame(quiet); }, { capture: true, passive: true });

  // ---- Play: the steps go by themselves and hold where the person acts --------------------------------
  const finished = () => !!S.view && S.step === 4 && !S.view.steps[4].waits && !!S.run?.decision && !!S.run?.summary;
  const covered = () => !!document.querySelector("dialog[open]") || !$("scenario-menu").hidden;

  function play() {
    if (S.mode === "live") return;
    if (finished()) { openCase(S.scenario); }
    P.on = true;
    P.last = 0;
    startClock();
    drawPlay();
    drawMove();
    if (!P.raf) P.raf = requestAnimationFrame(frame);
  }

  function pause() {
    if (!P.on) return;
    P.on = false;
    cancelAnimationFrame(P.raf);
    P.raf = 0;
    fill(0);
    drawPlay();
    drawMove();
  }

  function frame(now) {
    P.raf = 0;
    if (!P.on) return;
    // Time away from the tab, or a slow frame, does not count.
    const dt = P.last ? Math.min(now - P.last, 100) : 0;
    P.last = now;
    if (S.view) {
      if (P.step !== S.step) Object.assign(P, { step: S.step, at: 0 });
      const step = S.view.steps[S.step];
      const next = S.view.steps[S.step + 1];
      const holding = step.waits || (S.step === 3 && !!S.run?.decision && S.mode !== "live");
      if (holding) {
        P.at = 0;
      } else if (!next) {
        // The last step: once the story is over the button offers Replay at once; until then it is read.
        if (finished()) { fill(0); pause(); return; }
        if (!covered()) P.at += dt;
        if (P.at >= step.read) { fill(0); pause(); return; }
      } else if (next.ready && !covered()) {
        P.at += dt;
        if (P.at >= step.read) {
          goStep(S.step + 1, "play");
          P.raf = requestAnimationFrame(frame);
          return;
        }
      }
      fill(holding ? 0 : P.at / step.read);
      const left = Math.max(1, Math.ceil((step.read - P.at) / 1000));
      const words = !holding && next?.ready ? `in ${left} s` : "";
      if ($("move-note").textContent !== words) $("move-note").textContent = words;
    }
    P.raf = requestAnimationFrame(frame);
  }

  /** How far the current step is read: the rail to the next step and the bar's line fill with it. */
  function fill(p) {
    const v = Math.max(0, Math.min(1, p)).toFixed(4);
    document.querySelectorAll("#steps .vc-step").forEach((li, i) => li.style.setProperty("--vc-step-fill", i === S.step ? v : "0"));
    $("move-fill").style.setProperty("--fill", v);
    if (p === 0) $("move-note").textContent = "";
  }

  /** Play, Pause or Replay; in a live run the page follows the agent, so Stop in the bar takes Play's place. */
  function drawPlay() {
    const b = $("play");
    b.hidden = S.mode === "live";
    const state = P.on ? "pause" : finished() ? "replay" : "play";
    if (b.dataset.state === state) return;
    b.dataset.state = state;
    b.querySelector(".vc-icon").className = `vc-icon vc-icon--${state === "pause" ? "pause" : state === "replay" ? "refresh" : "play"}`;
    $("play-text").textContent = state === "pause" ? "Pause" : state === "replay" ? "Replay" : "Play";
  }
  $("play").addEventListener("click", () => (P.on ? pause() : play()));

  function goStep(i, how) {
    const id = STEP_IDS[Math.max(0, Math.min(4, i))];
    if (!shell.go(id, how)) render();
  }
  // A presentation clicker sends PageDown and PageUp, or the arrow keys the shell already reads.
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || document.querySelector("dialog[open]") || e.target.closest?.("input, textarea, select")) return;
    if (e.key === "PageDown") goStep(S.step + 1, "key");
    else if (e.key === "PageUp") goStep(S.step - 1, "key");
    else return;
    e.preventDefault();
  });

  // ---- the person's decisions, on the bus as the agent and the player expect them -------------------
  function decide(optionId, decision) {
    const o = S.run?.options;
    if (!o || S.run.decision) return;
    const opt = o.options.find((x) => x.id === optionId);
    bus.emit("option_decision", { options_seq: o.options_seq, option_id: optionId, option_label: opt ? `Option ${opt.letter}: ${opt.title}` : "Do nothing", decision, by: "user" });
    shell.announce(decision === "rejected" ? `You rejected option ${opt?.letter}.` : optionId === "baseline" ? "You accepted the loss." : `You approved option ${opt?.letter}. The agent drafts what it allows.`);
  }
  function decideDraft(id, decision) {
    bus.emit("action_decision", { action_id: id, decision, by: "user" });
  }
  function approveAll() {
    for (const d of S.run?.drafts || []) if ((d.status || "pending") === "pending") decideDraft(d.action_id, "approved");
    shell.announce("You approved every draft. Nothing was sent.");
  }

  // ---- a live run on the visitor's key ----------------------------------------------------------------
  async function startLive() {
    pause();
    stopRun();
    const live = await import("./live.js");
    S.mode = "live";
    S.events = [];
    // The simulation's run is gone: the page starts at step 1 and follows the agent from there.
    S.run = null;
    S.follow = true;
    S.runId = newRunId();
    shell.setMode("live");
    bus.beginRun({ run_id: S.runId, mode: "live" });
    bus.emit("run_start", { run_id: S.runId, mode: "live", entry: "scenario", scenario_id: S.scenario.id, title: S.scenario.title, seed: S.scenario.seed, model: DEFAULT_MODEL, model_label: MODEL_LABEL });
    clock.reset();
    S.clockOn = false;
    startClock();
    S.step = 0;
    shell.go(STEP_IDS[0], "code");
    shell.announce("The live run started. You are interacting with an AI system.");
    $("agent-note").textContent = "Claude, live on your key";
    S.live = live.startLive({
      scenario: S.scenario,
      onEnd: () => schedule(),
      onWebSearchOff: () => bus.emit("notice", { level: "warn", text: "Web search is switched off for this key's organisation, so the agent can confirm less on its own." })
    });
    render();
  }

  // ---- the session-cost estimate, worked out in a worker for every case -------------------------------
  function estimateAll() {
    const order = [S.scenario, ...CASES.filter((c) => c !== S.scenario)];
    try {
      const w = new Worker(new URL("./estimate-worker.js", import.meta.url), { type: "module" });
      w.onmessage = ({ data }) => {
        if (data.error) return console.warn("[Rebate Hunter] estimate:", data.error);
        estimates.set(data.id, data);
        fillEstimate();
        schedule();
      };
      w.postMessage({ world: window.WORLD, referenceCases: window.REFERENCE_CASES, scripts: SCRIPTS, scenarios: order, today: new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) });
    } catch (err) {
      console.warn("[Rebate Hunter] no estimate worker:", err);
    }
  }
  function fillEstimate() {
    const e = estimates.get(S.scenario.id);
    const lead = estimates.get(UI.defaultScenario);
    for (const el of document.querySelectorAll('[data-fig="estimate"]')) if (e) el.textContent = cents(e.eur);
    for (const el of document.querySelectorAll('[data-fig="lead-estimate"]')) if (lead) el.textContent = cents(lead.eur);
    for (const el of document.querySelectorAll('[data-fig="model"]')) el.textContent = MODEL_LABEL;
  }

  // ---- the guide: the lead case's figures, from the same run the page shows ---------------------------
  function fillGuide(view, run) {
    const lead = CASES.find((c) => c.id === UI.defaultScenario) || CASES[0];
    const v = view.case.id === lead.id ? view : null;
    if (!v) return;
    const calc = v.steps[2].card?.figs || [];
    const rec = run.options?.options.find((o) => o.recommended);
    const fin = [...run.estimates].reverse().find((x) => x.result.variants?.length)?.result;
    const ay = fin?.years.find((y) => y.year === (fin.baseline.first_loss_year || "AY"));
    const firstAy = run.estimates[0]?.result?.years?.find((y) => y.year === ay?.year);
    const minutes = [...document.querySelectorAll("#guide .vc-guide__path .vc-guide__time")].map((t) => parseFloat(t.textContent));
    const figs = {
      stake: v.kpis.stake?.value, "first-stake": calc[0]?.value, deadline: v.kpis.deadline?.value,
      owed: ay ? eur(ay.owed_eur) : "", spend: ay ? eurSpend(ay.spend_eur) : "", "first-spend": firstAy ? eurSpend(firstAy.spend_eur) : "", threshold: eurSpend(fin?.years?.[0] ? model.agreements.get(lead.agreement_id).tiers[0].from_eur : 0),
      "rec-letter": rec?.letter, "rec-cost": rec ? eur(rec.response_cost_eur) : "", "rec-left": rec ? eur(rec.residual_var_eur) : "",
      found: v.steps[1].foundNames?.join(" and ") || "", drafts: count(run.drafts.length || 2),
      "decision-min": `${minutes.slice(0, 4).reduce((a, b) => a + b, 0)} min`
    };
    document.querySelectorAll("#guide [data-fig]").forEach((el) => { const x = figs[el.dataset.fig]; if (x !== undefined && x !== null && x !== "") el.textContent = x; });
  }

  // The guide holds Play: the first time it closes Play starts, unless a link asked for a step; later
  // only its Start button plays.
  let firstClose = guide.open;
  guide.addEventListener("vc:guideclose", (e) => {
    startClock();
    const done = e.detail?.returnValue === "done";
    if (S.mode !== "live" && ((firstClose && !asked) || done)) play();
    firstClose = false;
    if (document.activeElement === document.body) $("story").focus({ preventScroll: true });
  });

  // ---- go -----------------------------------------------------------------------------------------------
  const first = CASES.find((c) => slugOf(c) === getParam("case")) || CASES.find((c) => c.id === UI.defaultScenario) || CASES[0];
  let asked = STEP_IDS.includes(getParam("step")) ? getParam("step") : null;
  openCase(first);
  estimateAll();
  rested().then(() => {
    render();
    // The guide tells the lead case; its figures are written in the page and filled again here from the
    // run on screen when that is the lead case (tests/docs.mjs checks the written ones against the engine).
    if (first.id === UI.defaultScenario) fillGuide(S.view, S.run);
    fillEstimate();
    // A link to a step opens it, paused, once the run has come that far, or the furthest step it reached.
    if (asked) goStep(Math.min(STEP_IDS.indexOf(asked), S.view.steps.findLastIndex((st) => st.ready)), "code");
    if (!guide.open && !asked) play();
    document.documentElement.dataset.boot = "ready";
    $("boot").dataset.state = "done";
    setTimeout(() => $("boot")?.remove(), 400);
  });
}
