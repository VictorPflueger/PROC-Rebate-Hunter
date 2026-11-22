// The docs say what the page and the engine say, in Node.
//   guide    every figure written in the guide (data-fig) is what js/main.js writes there from the
//            lead case's run: the engine's stake, deadline, threshold, first and verified counts, the
//            recommended option and its cost, the account the agent found, the estimate
//   tiles    the four tiles as written show the engine's figures before anything runs
//   script   DEMO_SCRIPT.md tells the guide's five steps in the guide's words, with the same times
//   readme   README.md and DEMO_SCRIPT.md quote the engine's figures, name version 8.0.0 as js/config.js
//            does, and every file they link to exists
// Usage: node tests/docs.mjs
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { pathToFileURL } from "node:url";
import { APP_ROOT } from "./lib/harness.mjs";

const read = (f) => readFileSync(path.join(APP_ROOT, f), "utf8");
const results = [];
const check = (ok, what) => results.push([!!ok, what]);
const html = read("index.html");
const text = (s) => s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

const sandbox = { window: {} };
vm.createContext(sandbox);
for (const f of ["world.js", "scenarios.js", "reference_cases.js", "sim_runs.js"]) vm.runInContext(read(`data/${f}`), sandbox);
const { WORLD, SCENARIOS, REFERENCE_CASES, SIM_RUNS } = sandbox.window;
globalThis.WORLD = WORLD;
globalThis.REFERENCE_CASES = REFERENCE_CASES;
const mod = (p) => import(pathToFileURL(path.join(APP_ROOT, p)).href);
const { getModel } = await mod("js/world.js");
const { playHeadless } = await mod("js/headless.js");
const { digest } = await mod("js/run.js");
const { story } = await mod("js/story.js");
const { estimateCost } = await mod("js/estimate.js");
const { eur, eurSpend, cents } = await mod("js/plain.js");
const { UI, APP } = await mod("js/config.js");
const model = getModel();
const lead = SCENARIOS.find((s) => s.id === UI.defaultScenario);

// The lead case as the page plays it, up to the decision and through it.
const events = await playHeadless(SIM_RUNS[lead.id], lead.id);
const run = digest(events);
const before = story({ model, scenario: lead, run: digest(events.slice(0, events.findIndex((e) => e.type === "option_decision"))), mode: "simulation" });
const fin = [...run.estimates].reverse().find((x) => x.result.variants?.length).result;
const firstRes = run.estimates[0].result;
const due = fin.years.find((y) => y.year === (fin.baseline.first_loss_year || "AY"));
const firstDue = firstRes.years.find((y) => y.year === due.year);
const rec = run.options.options.find((o) => o.recommended);
const estimate = estimateCost({ events, model, scenario: lead });
const minutes = [...html.matchAll(/class="vc-guide__time">\s*(\d+)\s*min</g)].map((m) => Number(m[1]));
const want = {
  stake: before.kpis.stake.value, deadline: before.kpis.deadline.value, threshold: eurSpend(model.agreements.get(lead.agreement_id).tiers[0].from_eur),
  "first-stake": eur(firstRes.baseline.rebate_at_risk_eur), "first-spend": eurSpend(firstDue.spend_eur), spend: eurSpend(due.spend_eur), owed: eur(due.owed_eur),
  "rec-letter": rec.letter, "rec-cost": eur(rec.response_cost_eur), "rec-left": eur(rec.residual_var_eur), found: before.steps[1].foundNames.join(" and "),
  "decision-min": `${minutes.slice(0, 4).reduce((a, b) => a + b, 0)} min`, "lead-estimate": cents(estimate.eur), estimate: cents(estimate.eur), model: "Sonnet 5.5"
};

// ---- guide ----------------------------------------------------------------------------------------------
const figs = [...html.matchAll(/data-fig="([a-z-]+)"[^>]*>([^<]*)</g)].map((m) => [m[1], m[2].trim()]);
const wrong = figs.filter(([k, v]) => k in want && v !== want[k]).map(([k, v]) => `${k} reads ${v}, the engine ${want[k]}`);
const unknown = [...new Set(figs.filter(([k]) => !(k in want)).map(([k]) => k))];
check(figs.length >= 20 && !wrong.length && !unknown.length, `${figs.length} figures written in the page are the engine's for ${lead.short}${wrong.length ? `: ${wrong.join("; ")}` : ""}${unknown.length ? `; not checked: ${unknown.join(", ")}` : ""}`);
check(minutes.length >= 3 && minutes.length <= 7 && minutes.reduce((a, b) => a + b, 0) <= 6, `the talk track has ${minutes.length} timed steps, ${minutes.reduce((a, b) => a + b, 0)} minutes in all`);
check(before.steps[2].title === `From ${want["first-stake"]} on the first count to ${want.stake} at stake`, `Calculate tells the correction: "${before.steps[2].title}"`);

// ---- tiles ----------------------------------------------------------------------------------------------
const tile = (name) => text((html.match(new RegExp(`data-vc-kpi="${name}"[\\s\\S]*?<p class="vc-stat__value[^"]*">([\\s\\S]*?)</p>`)) || [])[1] || "");
const tiles = [tile("Rebate at stake"), tile("Claim deadline"), tile("Detection → decision"), tile("Session cost")];
check(tiles.join("|") === [want.stake, want.deadline, "0:00", `≈ ${want.estimate}`].join("|"), `the tiles as written read ${tiles.join(", ")}`);

// ---- script ---------------------------------------------------------------------------------------------
const guideSteps = [...(html.match(/<ol class="vc-guide__path">([\s\S]*?)<\/ol>/) || [])[1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => {
  const li = m[1];
  return { cue: text((li.match(/<strong>([\s\S]*?)<\/strong>/) || [])[1] || ""), say: text((li.match(/class="vc-guide__say">([\s\S]*?)<\/span>\s*<span class="vc-guide__time"/) || [])[1] || ""), min: Number((li.match(/vc-guide__time">(\d+)/) || [])[1]) };
});
const demo = read("DEMO_SCRIPT.md");
const demoSteps = [...demo.matchAll(/^\d\. \*\*(.+?)\*\*.*\((\d+) min\)\n\s+(“.+”)$/gm)].map((m) => ({ cue: m[1], min: Number(m[2]), say: m[3] }));
const mismatch = guideSteps.map((g, i) => [g, demoSteps[i]]).filter(([g, d]) => !d || d.cue !== g.cue || d.say !== g.say || d.min !== g.min).map(([g]) => g.cue);
check(guideSteps.length === demoSteps.length && !mismatch.length, `DEMO_SCRIPT.md tells the guide's ${guideSteps.length} steps in its words${mismatch.length ? `; differs at: ${mismatch.join(" | ")}` : ""}`);

// ---- readme -----------------------------------------------------------------------------------------------
const readme = read("README.md");
for (const [f, doc] of [["README.md", readme], ["DEMO_SCRIPT.md", demo]]) {
  const missing = [want.stake, want.deadline, want["first-stake"], want["first-spend"], want.spend, want.owed, want.estimate].filter((x) => !doc.includes(x));
  check(!missing.length, `${f} quotes the engine's figures${missing.length ? `; missing: ${missing.join(", ")}` : ""}`);
  const links = [...doc.matchAll(/\]\(([^)#:]+)\)/g)].map((m) => m[1]);
  const broken = links.filter((l) => !existsSync(path.join(APP_ROOT, l)));
  check(!broken.length, `${f}'s links to files resolve (${links.length})${broken.length ? `; broken: ${broken.join(", ")}` : ""}`);
}
check(APP.version === "8.0.0" && /Version 8\.0\.0/.test(readme), `README.md names version ${APP.version}, as js/config.js does`);

for (const [ok, what] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
const failed = results.filter(([ok]) => !ok).length;
if (failed) { console.error(`\n${failed} docs check(s) failed.`); process.exit(1); }
console.log("\nDOCS OK");
