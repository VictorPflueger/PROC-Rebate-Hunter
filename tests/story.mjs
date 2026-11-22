// The presenter's words and figures, in Node (no browser): what js/plain.js, js/run.js and js/story.js
// make of the six scripts on every decision path, played headless through the unchanged simulation.
//   plain     record ids become names, codes become places, tool names become what they read
//   steps     every call of a run lands in its step: Spot, Check, Calculate, Propose, Prepare
//   paths     six cases × options A, B and C and doing nothing: five steps each, none empty, no id,
//             "undefined" or "NaN" in any word; the key figures are the engine's before and after the
//             decision; the drafts open only with a decision; the page waits where the person acts
//   lead      the Cisco case: €0 on the first count, €2.14M at stake, option A for €17,100, 31 days
//   pace      Play reads a step for 7 to 14 seconds, by its words
//   cost      the live-run estimate is a few cents for every case, Cisco's about €0.14
// Usage: node tests/story.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { pathToFileURL } from "node:url";
import { APP_ROOT } from "./lib/harness.mjs";

const sandbox = { window: {} };
vm.createContext(sandbox);
for (const f of ["world.js", "scenarios.js", "reference_cases.js", "sim_runs.js"]) vm.runInContext(readFileSync(path.join(APP_ROOT, "data", f), "utf8"), sandbox);
const { WORLD, SCENARIOS, REFERENCE_CASES, SIM_RUNS } = sandbox.window;
globalThis.WORLD = WORLD;
globalThis.REFERENCE_CASES = REFERENCE_CASES;
const mod = (p) => import(pathToFileURL(path.join(APP_ROOT, p)).href);
const { getModel } = await mod("js/world.js");
const { simulateRebate } = await mod("js/rebate.js");
const { plain, eur, nicknames } = await mod("js/plain.js");
const { digest, estimates, STEP_IDS } = await mod("js/run.js");
const { story, slugOf, caseList } = await mod("js/story.js");
const { playHeadless } = await mod("js/headless.js");
const { estimateCost } = await mod("js/estimate.js");
const { UI } = await mod("js/config.js");
const model = getModel();

let passed = 0;
const ok = (what) => { passed += 1; console.log(`ok: ${what}`); };

// Every id the data gives a record, as it could show on screen.
const IDS = new Set();
for (const v of WORLD.vendors) { IDS.add(v.id); if (v.tax_id) IDS.add(v.tax_id); }
for (const x of [...WORLD.agreements, ...WORLD.groups, ...WORLD.company_codes]) IDS.add(x.id);
for (const x of [...WORLD.groups, ...(WORLD.register || [])]) if (x.lei) IDS.add(x.lei);
const ID = new RegExp(`(?<![\\w-])(${[...IDS].filter((s) => String(s).length >= 4).map((s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}|L-\\d{5}|KONZS)(?![\\w-])`);
const BROKEN = /\b(undefined|NaN|null)\b|\{\{|\}\}|\[object /;
/** The words a stage shows (its data also carries the records' ids, which the page never draws). */
const stageText = (st) => [st.title, st.text,
  ...(st.race?.rows || []).flatMap((r) => [r.label, ...r.segments.map((g) => g.name)]),
  ...(st.members || []).flatMap((m) => [m.name, m.place]), ...(st.lookalikes || []).flatMap((l) => [l.name, l.group]),
  ...(st.cards || []).flatMap((c) => [c.title, c.description, c.risk])].filter(Boolean).join(" ");
/** Every string a step carries, joined: what the page can show of it. */
const textOf = (x) => (typeof x === "string" ? x : Array.isArray(x) ? x.map(textOf).join(" ") : x && typeof x === "object" ? Object.values(x).map(textOf).join(" ") : "");

// ---- plain: the visitor's words ------------------------------------------------------------------
{
  const say = (t, letters = {}) => plain(t, { model, letters });
  assert.equal(say("Meraki Cloud Networks (10003) bills on its own account."), "Meraki Cloud Networks bills on its own account.");
  assert.equal(say("vendor accounts 10003, 10004 and 10005 are missed"), "the accounts of Meraki, Acacia and Splunk are missed");
  assert.equal(say("Under agreement RA-CISCO the rebate is 2 %."), "Under the Cisco agreement the rebate is 2 %.");
  assert.equal(say("Billed to CC-1000."), "Billed to Frankfurt.");
  assert.equal(say("Set group key CISCO on the accounts"), "Set the Cisco group key on the accounts");
  assert.equal(say("maintain the group key BROADCOM (vendor master field KONZS) on VMware"), "maintain the Broadcom group key on VMware");
  assert.equal(say("G-CISCO owns it"), "Cisco owns it");
  assert.equal(say("I called erp_family_tree and sim_rebate."), "I called the register and the engine.");
  assert.equal(say("V1 or V3", { V1: "A", V3: "C" }), "option A or option C");
  assert.equal(say("The AY claim lapses on 2026-12-23; PY is open."), "The closed year claim lapses on 23 Dec 2026; the previous year is open.");
  assert.equal(say("Each draft waits in the Outbox."), "Each draft waits in step 5.");
  assert.doesNotMatch(say(`GLEIF ${WORLD.groups[0].lei} confirms it`), /[0-9A-Z]{20}/);
  assert.deepEqual(nicknames(model, ["10003", "10004", "10005"]), ["Meraki", "Acacia", "Splunk"]);
  assert.deepEqual(nicknames(model, ["10001", "10002"]), ["Cisco Systems", "Cisco Technology"], "a name that is the group's keeps a second word");
  ok("plain: account numbers, agreements, company codes, groups, group keys, LEIs, tools, options, years, dates and the Outbox become words");
}

// ---- steps: where each call lands ----------------------------------------------------------------
const lead = SCENARIOS.find((s) => s.id === UI.defaultScenario);
{
  const events = await playHeadless(SIM_RUNS[lead.id], lead.id);
  const run = digest(events);
  const at = (name) => [...new Set(run.calls.filter((c) => c.name === name).map((c) => STEP_IDS[c.step]))];
  assert.deepEqual(at("erp_get_agreement"), ["spot"]);
  assert.deepEqual(at("erp_family_tree"), ["check"]);
  assert.deepEqual(at("sim_rebate"), ["calculate"]);
  assert.deepEqual(at("ui_propose_options"), ["propose"]);
  assert.deepEqual(at("ui_draft_action"), ["prepare"]);
  assert.equal(run.reached, 4);
  assert.ok(run.narration.some((m) => m.step === 1 && /^Revised:/.test(m.text)), "the self-correction is told at Check");
  assert.ok(run.narration.some((m) => m.step === 2 && /^Impact:/.test(m.text)), "the impact is told at Calculate");
  const { first, finding } = estimates(run);
  assert.equal(first.baseline.rebate_at_risk_eur, 0);
  assert.equal(Math.round(finding.baseline.rebate_at_risk_eur), 2137920);
  ok("steps: the agreement at Spot, the register at Check, the engine at Calculate, the options at Propose, the drafts at Prepare");
}

// ---- paths: six cases, every decision ------------------------------------------------------------
let screens = 0;
for (const sc of SCENARIOS) {
  const ref = REFERENCE_CASES[sc.id];
  const fin = simulateRebate(model, ref.finding);
  const atStake = fin.baseline.value_at_risk_eur;
  for (const choice of [...fin.variants.map((v) => v.variant_id), "baseline"]) {
    const where = `${sc.short}, ${choice}`;
    const events = await playHeadless(SIM_RUNS[sc.id], sc.id, { choose: () => choice });
    const run = digest(events);
    const v = story({ model, scenario: sc, run, mode: "simulation" });
    assert.equal(v.steps.length, 5, where);
    for (const s of v.steps) {
      screens += 1;
      const words = textOf([s.title, s.lead, s.card, stageText(s.stage), s.agent, s.turn]);
      assert.ok(s.title && s.lead, `${where}, ${s.id}: a title and a lead`);
      assert.doesNotMatch(words, ID, `${where}, ${s.id}: a record id on screen`);
      assert.doesNotMatch(words, BROKEN, `${where}, ${s.id}: broken words`);
      assert.ok(s.read >= 7000 && s.read <= 14000, `${where}, ${s.id}: Play reads it for ${s.read} ms`);
    }
    // Before the decision: the engine's stake and deadline, Propose waits, the drafts are closed.
    const before = digest(events.slice(0, events.findIndex((e) => e.type === "option_decision")));
    const b = story({ model, scenario: sc, run: before, mode: "simulation" });
    assert.equal(b.kpis.stake.value, eur(atStake), `${where}: the stake before the decision`);
    if (fin.baseline.first_loss_day !== null) assert.equal(b.kpis.deadline.value, `${fin.baseline.first_loss_day} day${fin.baseline.first_loss_day === 1 ? "" : "s"}`, `${where}: the deadline`);
    assert.deepEqual(b.steps.map((s) => s.waits), [false, false, false, true, false], `${where}: the page waits at Propose`);
    assert.equal(b.steps[4].ready, false, `${where}: the drafts wait for a decision`);
    assert.ok(b.steps[3].turn && /Approve/.test(b.steps[3].turn), `${where}: the turn says what to approve`);
    // After it: the chosen option's figures, the drafts open, every draft approved, nothing waits.
    assert.equal(v.steps[4].ready, true, `${where}: the drafts open with the decision`);
    assert.deepEqual(v.steps.map((s) => s.waits), [false, false, false, false, false], `${where}: nothing waits once all is approved`);
    if (choice === "baseline") {
      assert.equal(v.kpis.stake.value, eur(atStake), `${where}: the loss accepted`);
      assert.match(v.kpis.stake.note, /accepted the loss/);
    } else {
      const opt = run.options.options.find((o) => o.id === choice);
      assert.equal(v.kpis.stake.value, eur(opt.residual_var_eur), `${where}: what is left with the option`);
      assert.equal(v.kpis.stake.was, eur(atStake), `${where}: the old stake struck through`);
    }
    assert.ok(v.log.length >= 1 && v.log[0].who === "You", `${where}: the decision is logged`);
    assert.ok(v.steps[4].card.drafts.every((d) => d.status === "approved"), `${where}: every draft approved`);
  }
}
ok(`paths: ${screens} screens of ${SCENARIOS.length} cases on every decision path: titled, worded without ids, the engine's figures, waits where the person acts`);

// ---- lead: the case the page opens on --------------------------------------------------------------
{
  const biggest = SCENARIOS.map((sc) => [sc, simulateRebate(model, REFERENCE_CASES[sc.id].finding).baseline.value_at_risk_eur]).sort((a, b) => b[1] - a[1])[0][0];
  assert.equal(lead.id, biggest.id, "the page opens on the biggest stake");
  const events = await playHeadless(SIM_RUNS[lead.id], lead.id);
  const before = digest(events.slice(0, events.findIndex((e) => e.type === "option_decision")));
  const v = story({ model, scenario: lead, run: before, mode: "simulation" });
  assert.equal(v.steps[2].title, "From €0 on the first count to €2.14M at stake");
  assert.equal(v.steps[3].title, "Option A for €17,100 claims all €2.14M");
  assert.deepEqual([v.kpis.stake.value, v.kpis.deadline.value], ["€2.14M", "31 days"]);
  assert.deepEqual(v.steps[1].foundNames, ["Splunk"]);
  assert.equal(slugOf(lead), "cisco-acquisitions");
  assert.equal(caseList(SCENARIOS).length, 6);
  ok("lead: Cisco, the biggest stake: €0 on the first count, €2.14M at stake, 31 days, option A for €17,100, Splunk found by the agent");
}

// ---- cost: the live-run estimate -------------------------------------------------------------------
{
  for (const sc of SCENARIOS) {
    const events = await playHeadless(SIM_RUNS[sc.id], sc.id);
    const e = estimateCost({ events, model, scenario: sc });
    assert.ok(e.eur > 0.05 && e.eur < 0.5, `${sc.short}: an estimate of €${e.eur.toFixed(3)}`);
    assert.ok(e.calls >= 10, `${sc.short}: ${e.calls} model calls`);
    if (sc.id === lead.id) assert.equal(`€${e.eur.toFixed(2)}`, "€0.14");
  }
  ok("cost: every case a few cents live, Cisco about €0.14");
}

console.log(`\nAll ${passed} story tests passed.`);
