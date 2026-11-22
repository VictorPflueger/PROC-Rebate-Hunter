// A run as the presenter needs it. The simulation player and the live agent emit the same events on the
// bus (js/events.js); digest() reads them in order and sorts what happened into the five steps. Pure
// module: the page feeds it the bus, the tests the events of a headless run.
//
// Each tool call belongs to a step by what it does: reading the agreement and the accounts is Spot
// until the agent starts to verify or to count, the register, GLEIF and the web are Check, the engine
// and the ledger Calculate, the options Propose, the drafts and the summary Prepare. The agent's words
// go to the step of the call before them, so a script that goes back to the register after a first
// estimate puts that check under Check, where a visitor looks for it. How far the run has come only
// moves forward. Every decision a person takes also goes into the log, with its time.

export const STEP_IDS = ["spot", "check", "calculate", "propose", "prepare"];
const SPOT = 0, CHECK = 1, CALCULATE = 2, PROPOSE = 3, PREPARE = 4;

function stepOfTool(name, started) {
  if (name === "erp_family_tree" || name === "web_search" || name.startsWith("open_") || name === "ui_report_alert") return CHECK;
  if (name === "sim_rebate") return CALCULATE;
  if (name.startsWith("erp_")) return started ? CALCULATE : SPOT;
  if (name === "ui_propose_options" || name === "ui_await_decision") return PROPOSE;
  if (name === "ui_draft_action" || name === "ui_await_approvals" || name === "ui_final_report") return PREPARE;
  return null;
}

export function digest(events) {
  const r = {
    mode: null, scenarioId: null, narration: [], calls: [], tree: null, agreement: null, report: null, estimates: [], alert: null,
    options: null, rejected: [], decision: null, drafts: [], summary: null, cost: null, notices: [], end: null, log: [], reached: 0, working: null
  };
  const said = new Map();
  const calls = new Map();
  let cursor = SPOT;
  let started = false;
  for (const e of events) {
    const p = e.payload || {};
    switch (e.type) {
      case "run_start": r.mode = p.mode; r.scenarioId = p.scenario_id || null; break;
      case "narration": {
        const m = said.get(p.msg_id) || { id: p.msg_id, step: cursor };
        m.text = p.text;
        said.set(p.msg_id, m);
        break;
      }
      case "tool_call": {
        const step = stepOfTool(p.name, started);
        if (step === CHECK || step === CALCULATE) started = true;
        if (step !== null) cursor = step;
        const c = { id: p.call_id, name: p.name, input: p.input || {}, server: !!p.server, step: cursor, ok: null, result: null, summary: "", sources: [] };
        calls.set(p.call_id, c);
        r.calls.push(c);
        r.working = c;
        break;
      }
      case "tool_result": {
        const c = calls.get(p.call_id);
        if (c) Object.assign(c, { ok: p.ok, result: p.result ?? null, summary: p.summary || "", sources: p.sources || [] });
        if (p.ok && c?.name === "erp_family_tree" && p.result?.group) r.tree = p.result;
        if (p.ok && c?.name === "erp_get_agreement" && p.result?.id) r.agreement = p.result;
        if (p.ok && c?.name === "erp_get_rebate_report" && p.result?.runs) r.report = p.result;
        if (p.ok && p.name === "sim_rebate" && p.result?.ok) r.estimates.push({ result: p.result, step: c?.step ?? CALCULATE });
        if (r.working === c) r.working = null;
        break;
      }
      case "alert": r.alert = p; cursor = Math.max(cursor, CHECK); break;
      case "options": r.options = p; r.rejected = []; cursor = PROPOSE; break;
      case "option_decision":
        if (p.decision === "approved") { r.decision = p; cursor = PREPARE; } else r.rejected.push(p.option_id);
        r.log.push({ at: e.ts || null, kind: "option", ...p });
        break;
      case "action_draft": r.drafts.push({ ...p }); cursor = PREPARE; break;
      case "action_decision": {
        const d = r.drafts.find((x) => x.action_id === p.action_id);
        if (d) d.status = p.decision;
        r.log.push({ at: e.ts || null, kind: "draft", ...p, type: d?.type || null, recipient: d?.recipient || null });
        break;
      }
      case "report": r.summary = p; break;
      case "cost_update": r.cost = p; break;
      case "notice": r.notices.push({ ...p, step: cursor }); break;
      case "run_end": r.end = p; r.working = null; break;
      default: break;
    }
    r.reached = Math.max(r.reached, cursor);
  }
  r.narration = [...said.values()].filter((m) => m.text && m.text.trim());
  return r;
}

/** The first estimate and the result the options rest on (the last one with costed variants, or the last). */
export function estimates(run) {
  const list = run.estimates.map((x) => x.result);
  const finding = [...list].reverse().find((x) => x.variants?.length) || (list.length > 1 ? list.at(-1) : null);
  return { first: list[0] || null, finding, all: list };
}
