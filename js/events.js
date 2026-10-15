// The run-event bus. Every UI effect flows through here, whether a live agent or the simulation
// player produced it. The UI subscribes to event types and never asks which producer is running;
// only the mode badge, the console watermark and the audit export read the envelope's `mode`.
//
// Envelope: { id, seq, type, ts (ISO), t (ms since run start or null), run_id, mode, payload }
//
// Event types and payloads
//   run_start        { run_id, mode: "live"|"simulation", entry: "scenario"|"scan"|"custom", scenario_id?, title, seed?,
//                      model?, model_label?, sim_source?: "authored"|"recorded", recorded_on?, recorded_model? }
//   state_change     { state, note? }   states: see RUN_STATES
//   narration        { msg_id, text, done }            streamed upsert: same msg_id replaces text
//   reasoning        { msg_id, text, done }            summarised model thinking (shown collapsed)
//   tool_call        { call_id, name, input, server }  server=true for Anthropic-hosted tools (web_search)
//   tool_result      { call_id, name, ok, summary, result, server, sources? }
//   alert            { title, severity, basis: "verified"|"what_if", summary, sources:[{title,url}], evidence?: [text],
//                      vendor_ids?, group_ids?, link_ids? }
//   board_update     { vendor_ids?, link_ids?, group_ids?, company_code_ids?, agreement_ids?, state, focus?, view?, source?,
//                      option_id?, linked_vendor_ids? }   decision payoffs carry the option and the accounts it links
//   kpi_update       { value_at_risk_eur?, projected_eur?, horizon_days?, first_loss_day?, first_loss_label?, first_loss_short?,
//                      basis?, stage?: "estimate"|"verified", label? }
//                    after a decision: { decided, accepted?, option_label, residual_eur?, total_eur?, before_eur, first_loss_day_after? }
//   options          { call_id?, options_seq, agreement_id, group_id?, member_vendor_ids?, horizon_days, recommended,
//                      baseline:{value_at_risk_eur, first_loss_day, ...}, options:[...] }
//   option_decision  { option_id, option_label, options_seq, decision: "approved"|"rejected", by: "user", note? }
//   action_draft     { action_id, type: "email"|"posting"|"memo", recipient, subject, body, status: "pending", unchecked?: [amount] }
//   action_decision  { action_id, decision: "approved"|"rejected", by: "user", label? }
//   report           { markdown, outcome? }
//   cost_update      { eur, usd, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, web_searches, simulated }
//   notice           { level: "info"|"warn"|"error", text }
//   attempt_discarded { msg_ids, call_ids, reason }   a response that was not kept (failed and retried, or redone)
//   run_end          { status: "done"|"no_findings"|"incomplete"|"aborted"|"error", reason? }
//                    incomplete: the agent stopped before the workflow was finished

export const RUN_STATES = {
  idle: "Idle",
  scanning: "Scanning",
  diagnosing: "Diagnosing",
  verifying: "Verifying",
  simulating: "Simulating",
  options: "Options",
  awaiting_approval: "Awaiting approval",
  executing: "Executing",
  done: "Done",
  stopped: "Stopped",
  aborted: "Aborted",
  error: "Error"
};

class RunEventBus {
  constructor() {
    this.handlers = new Map();
    this.anyHandlers = new Set();
    this.seq = 0;
    this.run = null; // { run_id, mode, t0 }
  }

  /** Subscribe to one event type. Returns an unsubscribe function. */
  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
    return () => this.handlers.get(type)?.delete(fn);
  }

  /** Subscribe to every event. Returns an unsubscribe function. */
  onAny(fn) {
    this.anyHandlers.add(fn);
    return () => this.anyHandlers.delete(fn);
  }

  /** Marks the start of a run so events carry run id, mode and relative time. */
  beginRun({ run_id, mode }) {
    this.run = { run_id, mode, t0: performance.now() };
  }

  endRun() {
    this.run = null;
  }

  currentRun() {
    return this.run ? { ...this.run } : null;
  }

  emit(type, payload = {}) {
    const envelope = {
      id: `ev-${Date.now().toString(36)}-${(++this.seq).toString(36)}`,
      seq: this.seq,
      type,
      ts: new Date().toISOString(),
      t: this.run ? Math.round(performance.now() - this.run.t0) : null,
      run_id: this.run?.run_id ?? null,
      mode: this.run?.mode ?? null,
      payload
    };
    for (const fn of this.handlers.get(type) || []) safeCall(fn, envelope);
    for (const fn of this.anyHandlers) safeCall(fn, envelope);
    return envelope;
  }
}

function safeCall(fn, envelope) {
  try {
    fn(envelope);
  } catch (err) {
    // A failing subscriber must never break the run; surface it in the browser console only.
    console.error(`[Rebate Hunter] event handler failed for ${envelope.type}:`, err);
  }
}

export const bus = new RunEventBus();

/** New run id, e.g. run-20261012-1556-k3f9. */
export function newRunId() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `run-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}-${Math.random().toString(36).slice(2, 6)}`;
}
