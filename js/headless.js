// A case's script played at once, out of sight, with an automatic person who approves the recommended
// option (or the option chosen) and every draft. It runs the unchanged simulation player on this
// module's own bus, so it must run alone: in the estimate worker (js/estimate-worker.js), which has a
// bus of its own, or in Node for the tests. Resolves the run's events, narration included.

import { bus, newRunId } from "./events.js";
import { createSimulationPlayer } from "./simulation.js";

export async function playHeadless(def, scenarioId, { choose = (options) => options.recommended, drafts = "approved" } = {}) {
  const events = [];
  const off = bus.onAny((ev) => {
    events.push(ev);
    if (ev.type === "options") queueMicrotask(() => bus.emit("option_decision", { options_seq: ev.payload.options_seq, option_id: choose(ev.payload), decision: "approved", by: "user" }));
    if (ev.type === "action_draft") queueMicrotask(() => bus.emit("action_decision", { action_id: ev.payload.action_id, decision: drafts, by: "user" }));
  });
  const player = createSimulationPlayer({ getSpeed: () => Infinity });
  const runId = newRunId();
  bus.beginRun({ run_id: runId, mode: "simulation" });
  bus.emit("run_start", { run_id: runId, mode: "simulation", entry: "scenario", scenario_id: scenarioId, sim_source: def.source || "authored" });
  try {
    await player.play(def, { scenario: scenarioId });
  } finally {
    off();
    bus.endRun();
  }
  return events;
}
