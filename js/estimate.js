// What a case would cost live, estimated from its own prompts and replies at list price: the run's
// events from a headless play (js/headless.js), grouped into the model calls the live agent would make.
// The assumptions, stated once: about four characters make a token; the system prompt and the tools
// are written to the cache once and read back on every later call, as is every message after the
// call that added it; independent reads go out in one call; the agent thinks about 300 tokens before
// each call; a web search costs $10 per 1,000 and brings about 3,000 tokens of results. Prices are
// those of js/config.js, converted at its fixed dollar rate. Pure module: the page and the tests share it.

import { toolDefinitions } from "./tools.js";
import { buildSystemPrompt, buildOpeningMessage } from "./prompt.js";
import { usageCostUsd } from "./cost.js";
import { FX_USD_EUR, DEFAULT_MODEL } from "./config.js";

export const CHARS_PER_TOKEN = 4;
export const THINKING_PER_CALL = 300;
export const SEARCH_TOKENS = 3000;
const tokens = (s) => Math.ceil(String(s || "").length / CHARS_PER_TOKEN);
const READS = (name) => name.startsWith("erp_") || name.startsWith("open_");

/** Estimated cost of a run: { eur, usd, calls, searches, input and output tokens }. */
export function estimateCost({ events, model, scenario, modelId = DEFAULT_MODEL, today = "Monday, 23 November 2026" }) {
  const prefix = tokens(buildSystemPrompt({ model, today, webSearch: true })) + tokens(JSON.stringify(toolDefinitions({ webSearch: true })));
  const opening = tokens(buildOpeningMessage({ entry: "scenario", model, today, seed: scenario.seed, scenarioTitle: scenario.title }));
  // One model call a turn: what the agent says, then its tool calls (independent reads together).
  const turns = [];
  let turn = null;
  const byCall = new Map();
  for (const e of events) {
    const p = e.payload || {};
    if (e.type === "narration" && p.done !== false) {
      if (!turn || turn.calls.length) turns.push(turn = { out: 0, calls: [], back: 0, searches: 0 });
      turn.out += tokens(p.text);
    } else if (e.type === "tool_call") {
      const parallel = turn && turn.calls.length && READS(p.name) && turn.calls.every(READS);
      if (!turn || (turn.calls.length && !parallel)) turns.push(turn = { out: 0, calls: [], back: 0, searches: 0 });
      turn.calls.push(p.name);
      turn.out += tokens(p.name) + tokens(JSON.stringify(p.input || {}));
      if (p.name === "web_search") turn.searches += 1;
      byCall.set(p.call_id, turn);
    } else if (e.type === "tool_result") {
      const t = byCall.get(p.call_id);
      if (t) t.back += tokens(JSON.stringify(p.result ?? {})) + (p.name === "web_search" ? SEARCH_TOKENS : 0);
    }
  }
  turns.push({ out: tokens("The summary is published; nothing was sent."), calls: [], back: 0, searches: 0 });
  let cached = 0;
  let pending = prefix + opening;
  let usd = 0;
  const total = { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0, calls: turns.length, searches: 0 };
  for (const t of turns) {
    const usage = { input_tokens: 0, cache_creation_input_tokens: pending, cache_read_input_tokens: cached, output_tokens: t.out + THINKING_PER_CALL, web_search_requests: t.searches };
    usd += usageCostUsd(modelId, usage);
    for (const k of ["cache_creation_input_tokens", "cache_read_input_tokens", "output_tokens"]) total[k] += usage[k];
    total.searches += t.searches;
    cached += pending;
    pending = t.out + t.back;
  }
  return { ...total, usd, eur: usd * FX_USD_EUR, model: modelId };
}
