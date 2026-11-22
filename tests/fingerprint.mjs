// The case stays intact: the engine, the company data, the tools, the live agent and the six scripts
// are 7.2.0's files (commit 73c00f8), byte for byte, and the engine gives 7.2.0's figures.
//   files    SHA-256 of every module, data file and tool the presenter builds on; js/config.js with its
//            version masked, the only line 8.0.0 changes there
//   figures  each case's first estimate and verified finding: what is at stake per year, the tiers
//            reached, the claim deadlines (in days from today) and the three options' costs and cash
// The fixture was written from a checkout of 7.2.0 with --write and is never rewritten by 8.0.0.
// Usage: node tests/fingerprint.mjs                    prints "FINGERPRINT OK" or the differences
//        node tests/fingerprint.mjs --write <7.2.0 dir>   writes the fixture from that checkout
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { pathToFileURL } from "node:url";
import { APP_ROOT } from "./lib/harness.mjs";

const FIXTURE = path.join(APP_ROOT, "tests", "fixtures", "fingerprint-7.2.0.json");
export const UNCHANGED = [
  // the engine and the company data it reads
  "js/rebate.js", "js/erp.js", "js/world.js", "js/clock.js", "js/similarity.js", "js/format.js",
  "data/world.js", "data/scenarios.js", "data/reference_cases.js",
  // the tools and their guardrails
  "js/tools.js", "js/guards.js", "js/figures.js", "js/drafts.js", "js/payoff.js", "js/summaries.js", "js/opendata.js", "js/source_health.js",
  // the live agent
  "js/agent.js", "js/anthropic.js", "js/sse.js", "js/keystore.js", "js/cost.js", "js/prompt.js", "js/audit.js", "js/run_facts.js", "js/labels.js", "js/events.js",
  // the simulation and its scripts
  "js/simulation.js", "js/sim_vars.js", "js/sim_check.js", "js/world_check.js", "data/sim_runs.js",
  // the tools that build and check the data
  "tools/build_world.mjs", "tools/check_world.mjs", "tools/legacy_seed.mjs", "tools/legacy_reference.py"
];
const sha = (s) => createHash("sha256").update(s).digest("hex");
const maskVersion = (s) => s.replace(/(\bversion:\s*")[^"]*(")/, "$1…$2");

function files(root) {
  const read = (f) => readFileSync(path.join(root, f));
  const out = Object.fromEntries(UNCHANGED.map((f) => [f, sha(read(f))]));
  out["js/config.js (version masked)"] = sha(maskVersion(read("js/config.js").toString("utf8")));
  return out;
}

// Dates count from today; the figures keep what does not move with the calendar.
const undate = (v) => JSON.parse(JSON.stringify(v, (k, x) => (typeof x === "string" ? x.replace(/\b\d{4}-\d{2}-\d{2}\b/g, "<date>") : x)));
const keep = (r) => undate({ ok: r.ok, basis: r.basis, baseline: r.baseline, years: r.years, members: r.members, variants: r.variants });

async function figures(root) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (const f of ["world.js", "scenarios.js", "reference_cases.js"]) vm.runInContext(readFileSync(path.join(root, "data", f), "utf8"), sandbox);
  const { WORLD, SCENARIOS, REFERENCE_CASES } = sandbox.window;
  globalThis.WORLD = WORLD;
  globalThis.REFERENCE_CASES = REFERENCE_CASES;
  // Day numbers count from today; the fixture's day is pinned, so a leap year or a month's length
  // cannot move a figure between the day it was written and the day it is checked.
  const { pinToday } = await import(pathToFileURL(path.join(root, "js/clock.js")).href);
  pinToday("2026-11-22T09:00:00Z");
  const { buildModel } = await import(pathToFileURL(path.join(root, "js/world.js")).href);
  const { simulateRebate } = await import(pathToFileURL(path.join(root, "js/rebate.js")).href);
  const model = buildModel(WORLD);
  return Object.fromEntries(SCENARIOS.map((sc) => [sc.id, {
    first: keep(simulateRebate(model, REFERENCE_CASES[sc.id].hypothesis)),
    finding: keep(simulateRebate(model, REFERENCE_CASES[sc.id].finding))
  }]));
}

const write = process.argv.indexOf("--write");
if (write >= 0) {
  const from = path.resolve(process.argv[write + 1] || "");
  const out = { written_from: "Rebate Hunter 7.2.0, commit 73c00f8", files: files(from), figures: await figures(from) };
  writeFileSync(FIXTURE, `${JSON.stringify(out, null, 1)}\n`);
  console.log(`Wrote ${path.relative(APP_ROOT, FIXTURE)} from ${from}.`);
  process.exit(0);
}

const fixture = JSON.parse(readFileSync(FIXTURE, "utf8"));
const problems = [];
const now = files(APP_ROOT);
for (const [f, h] of Object.entries(fixture.files)) if (now[f] !== h) problems.push(`${f} is not 7.2.0's file`);
for (const f of Object.keys(now)) if (!(f in fixture.files)) problems.push(`${f} has no fingerprint`);
const figs = await figures(APP_ROOT);
for (const [id, want] of Object.entries(fixture.figures)) {
  for (const k of ["first", "finding"]) {
    if (JSON.stringify(figs[id]?.[k]) !== JSON.stringify(want[k])) problems.push(`${id}: the ${k === "first" ? "first estimate" : "finding"} differs from 7.2.0's`);
  }
}
for (const p of problems) console.log(`FAIL  ${p}`);
if (problems.length) process.exit(1);
const cases = Object.keys(fixture.figures).length;
console.log(`${Object.keys(now).length} files are 7.2.0's byte for byte (js/config.js but for its version); ${cases} cases give 7.2.0's first estimate and finding, options included.`);
console.log("FINGERPRINT OK");
