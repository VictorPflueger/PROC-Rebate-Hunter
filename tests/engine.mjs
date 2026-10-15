// Golden-figure tests for the domain core (Node.js 20 or later; no browser needed):
//   legacy     the Streamlit version's 150 accounts and 1,203 orders, regenerated in JavaScript
//              (tools/legacy_seed.mjs), match the fingerprint Python prints (tools/legacy_reference.py)
//   similarity the difflib port gives Python's exact ratios, autojunk included
//   engine     the six reference cases give the frozen figures below, and the Streamlit headline holds:
//              Cisco group €52.4M → 2 % = €1,048,000
//   guardrails the engine refuses non-register merges, set-off where the contract forbids it,
//              claims on the running year and claims faster than their preparation
//   tools      ERP duplicate check, evidence rules, figure audit, draft lines, decision payoff
//   guards     figure scopes and formats, verified alerts, drafts per option, report outcomes,
//              partial counts, set-off timing, model-facing names, dates with a year
// A change that moves a figure must be deliberate: update the golden value and say why in the commit.
// Usage: node tests/engine.mjs
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { pathToFileURL } from "node:url";
import { APP_ROOT } from "./lib/harness.mjs";

const mod = (p) => import(pathToFileURL(path.join(APP_ROOT, p)).href);
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const f of ["data/world.js", "data/scenarios.js", "data/reference_cases.js"]) vm.runInContext(fs.readFileSync(path.join(APP_ROOT, f), "utf8"), sandbox);
const { WORLD, REFERENCE_CASES: REF } = sandbox.window;

const { legacyData } = await mod("tools/legacy_seed.mjs");
const { buildModel } = await mod("js/world.js");
const { simulateRebate } = await mod("js/rebate.js");
const { nameSimilarity, sequenceRatio } = await mod("js/similarity.js");
const { ERP_TOOLS } = await mod("js/erp.js");
const { isEvidence } = await mod("js/tools.js");
const { extractAmounts, unknownAmounts, collectFigures } = await mod("js/figures.js");
const { finalizeDraft, MOCK_POSTING_LINE, DRAFT_FOOTER } = await mod("js/drafts.js");
const { decisionEffects, optionFigures, baselineFigures } = await mod("js/payoff.js");
const { FigureLedger, EvidenceLog, verifiedAlertError, draftError, reportOutcome } = await mod("js/guards.js");
const { compactForModel } = await mod("js/rebate.js");
const { shortDate } = await mod("js/format.js");
const { pinToday } = await mod("js/clock.js");
const { ERP_TOOLS: ERP } = await mod("js/erp.js");

let passed = 0;
const ok = (label) => { passed += 1; console.log(`ok: ${label}`); };

// ---- legacy: Python's numbers, printed by tools/legacy_reference.py ------------------------------
{
  const PYTHON = {
    vendors: 150, orders: 1203,
    spend_cents: 37126153225, order_cents: 37126153218,
    first_filler: "30008 Inno IT-Services AG (Paris) 2353194.56",
    last_order: "4500001203|30148|2026-04-18|3495205",
    sha256: "06c81fa9b7eb0a0743468a87c99f902e5518d96ada1386b793f6aecb2c988b95"
  };
  const { vendors, pos } = legacyData();
  const cents = (x) => Math.round(x * 100);
  const lines = vendors.map((v) => `V|${v.LIFNR}|${v.NAME1}|${v.ORT01}|${v.LAND1}|${v.STCD1}|${v.SPEND_YTD.toFixed(2)}`)
    .concat(pos.map((o) => `O|${o.EBELN}|${o.LIFNR}|${o.AEDAT}|${cents(o.NETWR)}`));
  const last = pos[pos.length - 1];
  const got = {
    vendors: vendors.length, orders: pos.length,
    spend_cents: vendors.reduce((s, v) => s + cents(v.SPEND_YTD), 0),
    order_cents: pos.reduce((s, o) => s + cents(o.NETWR), 0),
    first_filler: `${vendors[9].LIFNR} ${vendors[9].NAME1} (${vendors[9].ORT01}) ${vendors[9].SPEND_YTD.toFixed(2)}`,
    last_order: [last.EBELN, last.LIFNR, last.AEDAT, cents(last.NETWR)].join("|"),
    sha256: crypto.createHash("sha256").update(lines.join("\n"), "utf8").digest("hex")
  };
  assert.deepEqual(got, PYTHON);
  ok("legacy data is bit-identical to Python's (150 accounts, 1,203 orders, sha256)");

  // The world carries every legacy account and order; seven accounts take their order total
  // because app.py truncated cents when it split the spend into orders.
  const byId = new Map(WORLD.vendors.map((v) => [v.id, v]));
  const legacyOrders = WORLD.purchase_orders.filter((o) => pos.some((p) => p.EBELN === o.id));
  assert.equal(vendors.every((v) => byId.has(v.LIFNR)), true);
  assert.equal(legacyOrders.length, 1203);
  const centFixed = WORLD.vendors.filter((v) => typeof v.legacy_spend_ytd === "number");
  assert.equal(centFixed.length, 7);
  assert.ok(centFixed.every((v) => Math.round((v.legacy_spend_ytd - v.spend.AY) * 100) === 1));
  ok("world.js carries all legacy accounts and orders (7 one-cent fixes)");
}

// ---- similarity: Python difflib ratios ----------------------------------------------------------------
{
  const PYTHON = [
    ["Apex Robotics Solutions GmbH", "Apex Robotics Systems Ltd.", 0.6666666666666666],
    ["Microsoft Deutschland GmbH", "Activision Blizzard Germany", 0.22641509433962265],
    ["Cisco Systems Germany GmbH", "Meraki Cloud Networks Ltd.", 0.23076923076923078],
    ["Cisco Systems Germany GmbH", "Cisco Technology Inc.", 0.46808510638297873],
    ["Salesforce UK Ltd", "Slack Technologies Limited", 0.4186046511627907],
    ["Global Logistics GmbH", "Global Logistics AG", 0.9]
  ];
  for (const [a, b, r] of PYTHON) assert.equal(nameSimilarity(a, b), r, `${a} / ${b}`);
  assert.equal(sequenceRatio(`${"a".repeat(10)}${"b".repeat(250)}`, `${"a".repeat(12)}${"b".repeat(240)}`), 0.0390625); // autojunk ≥ 200
  ok("difflib port matches Python exactly (6 name pairs, autojunk)");
}

// ---- engine: golden figures ---------------------------------------------------------------------------------
const model = buildModel(WORLD);
assert.deepEqual(model.problems, []);
{
  // [variant, response cost, still lost, expected total, first cash day]
  const GOLDEN = {
    "SC-CISCO-MA": { hyp: ["verified", 0], var: 2137920, first: [31, "AY"], lost: 0, AY: [52400000, 2, 1048000, 1048000], PY: [49200000, 0, 0],
      variants: [["V1", 17100, 0, 17100, 48], ["V2", 17500, 0, 17500, 12], ["V3", 3600, 1089920, 1093520, 48]] },
    "SC-MSFT-PY": { hyp: ["verified", 0], var: 1020000, first: [39, "PY"], lost: 0, AY: [47000000, 0, 0, 0], PY: [51000000, 1020000, 1020000],
      variants: [["V1", 12000, 0, 12000, 40], ["V2", 183600, 0, 183600, 65], ["V3", 20500, 0, 20500, 40]] },
    "SC-APEX-NAME": { hyp: ["what_if", 258300], var: 70725, first: [12, "AY"], lost: 0, AY: [2300000, 1.5, 34500, 34500], PY: [1800000, 0, 0],
      variants: [["V1", 6400, 0, 6400, 32], ["V2", 6800, 0, 6800, 11], ["V3", 2400, 36225, 38625, 32]] },
    "SC-AVGO-VMW": { hyp: ["verified", 869320], var: 1746880, first: [23, "AY"], lost: 784000, AY: [32400000, 3, 972000, 848000], PY: [30100000, 903000, 784000],
      variants: [["V1", 14600, 0, 14600, 48], ["V2", 3600, 898880, 902480, 48], ["V3", 11000, 848000, 859000, 373]] },
    "SC-SCHN-AVEVA": { hyp: ["partial", 379600], var: 892500, first: [9, "AY"], lost: 0, AY: [17500000, 2.5, 437500, 437500], PY: [14900000, 0, 0],
      variants: [["V1", 12100, 0, 12100, 33], ["V2", 12500, 0, 12500, 12], ["V3", 8500, 437500, 446000, 314]] },
    "SC-CRM-FX": { hyp: ["verified", 1394943], var: 1517267, first: [27, "AY"], lost: 668070, AY: [24671000, 3, 740130, 740130], PY: [22269000, 668070, 668070],
      variants: [["V1", 16100, 0, 16100, 33], ["V2", 7600, 62654, 70254, 33], ["V3", 12100, 777137, 789237, 33]] }
  };
  for (const [id, g] of Object.entries(GOLDEN)) {
    const h = simulateRebate(model, REF[id].hypothesis);
    const f = simulateRebate(model, REF[id].finding);
    assert.ok(h.ok && f.ok, id);
    assert.deepEqual([h.basis, h.baseline.value_at_risk_eur], g.hyp, `${id} first estimate`);
    assert.equal(f.basis, "verified", `${id} finding basis`);
    assert.equal(f.baseline.value_at_risk_eur, g.var, `${id} value at risk`);
    assert.deepEqual([f.baseline.first_loss_day, f.baseline.first_loss_year], g.first, `${id} first deadline`);
    assert.equal(f.baseline.lost_already_eur, g.lost, `${id} already lost`);
    const y = (k) => f.years.find((x) => x.year === k);
    assert.deepEqual([y("AY").spend_eur, y("AY").tier_pct, y("AY").owed_eur, y("AY").open_eur], g.AY, `${id} AY`);
    assert.deepEqual([y("PY").spend_eur, y("PY").owed_eur, y("PY").open_eur], g.PY, `${id} PY`);
    assert.deepEqual(f.variants.map((v) => [v.variant_id, v.response_cost_eur, v.residual_var_eur, v.total_cost_eur, v.time_to_effect_days]), g.variants, `${id} variants`);
    for (const v of f.variants) assert.equal(v.total_cost_eur, v.response_cost_eur + v.residual_var_eur, `${id} ${v.variant_id}: total = cost + still lost`);
  }
  ok("six reference cases give the golden figures (value at risk, years, three variants each)");

  // The Streamlit app's headline: Cisco consolidated €52.4M crosses €50m, 2 % = €1,048,000.
  const cisco = simulateRebate(model, REF["SC-CISCO-MA"].finding).years.find((x) => x.year === "AY");
  assert.equal(cisco.spend_eur, 52400000);
  assert.equal(cisco.owed_eur, 52400000 * 0.02);
  // … and its honest negative: Microsoft €47.0M stays below the threshold in the agreement year.
  const msft = simulateRebate(model, { agreement_id: "RA-MSFT", members: ["20001", "20002"], years: ["AY"] });
  assert.equal(msft.years.find((x) => x.year === "AY").owed_eur, 0);
  ok("Streamlit headline kept: Cisco €52.4M → €1,048,000; Microsoft €47.0M → nothing in the agreement year");

  // The sweep's honest negatives: two clean agreements owe nothing.
  for (const id of ["RA-CHROMA", "RA-OMNI"]) assert.equal(simulateRebate(model, { agreement_id: id }).baseline.value_at_risk_eur, 0, id);
  ok("clean agreements stay at €0 (sweep negatives)");

  // Deterministic: the same spec gives the same result.
  assert.deepEqual(simulateRebate(model, REF["SC-CRM-FX"].finding), simulateRebate(model, REF["SC-CRM-FX"].finding));
  ok("engine is deterministic");
}

// ---- guardrails in the engine ---------------------------------------------------------------------------------
{
  const err = (spec) => { const r = simulateRebate(model, spec); assert.equal(r.ok, false, JSON.stringify(spec)); return r.errors.join(" | "); };
  assert.match(err({ agreement_id: "RA-APEX", members: ["40001", "40002"] }), /40002 .*is not a member of Apex Robotics Holding AG in the subscription register \(the register lists it under Apex Industrial Group plc\)/);
  assert.match(err({ agreement_id: "RA-APEX", members: ["40001", "40002"] }), /Similar names, cities or categories never merge accounts/);
  const whatIf = simulateRebate(model, { agreement_id: "RA-APEX", members: ["40001", "40002"], what_if: true });
  assert.equal(whatIf.ok && whatIf.basis, "what_if");
  ok("only the register merges accounts; a look-alike counts only as a labelled what-if");

  assert.match(err({ agreement_id: "RA-MSFT", members: ["20001", "20002"], variants: [{ variant_id: "V1", name: "x", actions: [{ type: "set_off", years: ["PY"], start_in_days: 10 }] }] }), /RA-MSFT does not allow set-off/);
  assert.match(err({ agreement_id: "RA-CISCO", variants: [{ variant_id: "V1", name: "x", actions: [{ type: "claim", years: ["CY"], start_in_days: 3 }] }] }), /the running year \(CY\) has not ended, so it cannot be claimed yet/);
  assert.match(err({ agreement_id: "RA-CISCO", variants: [{ variant_id: "V1", name: "x", actions: [{ type: "claim", years: ["AY"], start_in_days: 1 }] }] }), /preparing the claim evidence takes 3 days.*earliest start_in_days is 3/);
  assert.match(err({ agreement_id: "RA-APEX", members: ["40001"], variants: [{ variant_id: "V1", name: "x", actions: [{ type: "link_accounts", vendor_ids: ["40002"] }] }] }), /40002 \(Apex Robotics Systems Ltd\.\) cannot be linked to RA-APEX: the subscription register lists it under Apex Industrial Group plc/);
  assert.match(err({ agreement_id: "RA-NONE" }), /unknown agreement "RA-NONE"/);
  ok("contract rules enforced: no set-off where forbidden, no running-year claim, preparation time, linking only members");
}

// ---- tools: duplicate check, evidence, figure audit, drafts, payoff ---------------------------------------------
{
  const dup = ERP_TOOLS.erp_find_duplicates(model, { vendor_id: "40001" });
  const apex = dup.candidates.find((c) => c.vendor_id === "40002");
  assert.equal(apex.name_similarity_pct, 66.7);
  assert.match(apex.register, /different groups in the register/);
  const cisco = ERP_TOOLS.erp_find_duplicates(model, { vendor_id: "10001" });
  assert.deepEqual(cisco.register_members_below_rule.find((m) => m.vendor_id === "10003"), { vendor_id: "10003", name: "Meraki Cloud Networks Ltd.", name_similarity_pct: 23.1 });
  ok("duplicate check: the 67 % look-alike is flagged but not merged; Meraki at 23 % would be missed by a name rule");

  assert.equal(isEvidence("erp_family_tree", { members: [] }), false);
  assert.equal(isEvidence("erp_family_tree", { members: [{}] }), true);
  assert.equal(isEvidence("open_gleif_search", { records: [] }), false);
  assert.equal(isEvidence("open_gleif_parent", { entity: { lei: "X" }, ultimate_parent: null }), false);
  assert.equal(isEvidence("open_gleif_parent", { entity: { lei: "X" }, ultimate_parent: { lei: "Y" } }), true);
  assert.equal(isEvidence("erp_get_spend", { accounts: [{ vendor_id: "99999", error: "unknown vendor id" }] }), false);
  assert.equal(isEvidence("open_gleif_parent", { found: false, lei: "X" }), false);
  assert.equal(isEvidence("open_wikidata_owner", { found: false }), false);
  assert.equal(isEvidence("open_ecb_rate", { error: "x", fallback_hint: "use web_search" }), false);
  assert.equal(isEvidence("sim_rebate", { ok: true }), false);
  ok("evidence rules: empty lookups and failures never count");

  const a = extractAmounts("Claim €1,048,000 (€1.05M), £4.6m and 437,500 EUR; 2 % and day 31.");
  assert.deepEqual(a.map((x) => [x.raw, x.value, x.tolerance]), [["€1,048,000", 1048000, 0.5], ["€1.05M", 1050000, 5000], ["£4.6m", 4600000, 50000], ["437,500 EUR", 437500, 0.5]]);
  const known = collectFigures({ owed_eur: 1048000, total: 2137920, note: "€50.0m threshold" });
  assert.deepEqual(unknownAmounts("We claim €1,048,000 of €2.14M; the threshold is €50m.", known), []);
  assert.deepEqual(unknownAmounts("We claim €1,084,500.", known).map((x) => x.raw), ["€1,084,500"]);
  assert.deepEqual(unknownAmounts("A day of work costs €95.", known), []);
  ok("figure audit: amounts must match a tool figure within the precision written");

  const posting = finalizeDraft("posting", "Company code: CC-1000\nAmount: €1,048,000");
  assert.ok(posting.includes(MOCK_POSTING_LINE) && posting.endsWith(DRAFT_FOOTER));
  assert.equal(finalizeDraft("posting", posting), posting);
  assert.ok(!finalizeDraft("email", "Dear team").includes(MOCK_POSTING_LINE));
  ok("drafts: AI footer always, mock line on postings, idempotent");

  const res = simulateRebate(model, REF["SC-CISCO-MA"].finding);
  const payload = {
    group_id: res.group_id, baseline: baselineFigures(res, "Do nothing"),
    options: res.variants.map((v, i) => ({ id: v.variant_id, letter: "ABC"[i], ...optionFigures(v) }))
  };
  payload.member_vendor_ids = res.members.map((m) => m.vendor_id);
  const fx = decisionEffects(payload, "V1");
  assert.deepEqual(fx[0], ["kpi_update", { decided: true, option_label: "option A", residual_eur: 0, total_eur: 17100, before_eur: 2137920, first_loss_day_after: null }]);
  const all = ["10001", "10002", "10003", "10004", "10005"];
  assert.deepEqual(fx[1], ["map_update", { vendor_ids: all, link_ids: all.map((x) => `L-${x}`), group_ids: ["G-CISCO"], state: "resolved", source: "decision" }]);
  const partial = decisionEffects(payload, "V3");
  assert.deepEqual(partial.slice(1).map(([, p]) => [p.state, p.group_ids, p.vendor_ids]), [["at_risk", ["G-CISCO"], all]]);
  ok("decision payoff: option A resolves every counted account and the group; option C leaves them at risk");
}

// ---- guards: the policy shared by the live tools and the script checker ------------------------------
{
  // Formats and currencies: a wrong amount is caught however it is written.
  const ledger = new FigureLedger();
  ledger.addFacts(ERP.erp_get_agreement(model, { agreement_id: "RA-CISCO" }));
  const finding = simulateRebate(model, REF["SC-CISCO-MA"].finding);
  ledger.addEngine(finding);
  ledger.setOptionsSource(finding);
  const unknown = (t, scope = "draft") => ledger.unknown(t, scope).map((a) => a.raw);
  assert.deepEqual(unknown("We claim €1,048,000 (€1.05M) under § 4.2; the threshold is €50.0m."), []);
  assert.deepEqual(unknown("Wir fordern 1.048.000,00 EUR bzw. 1.048.000 €."), []);
  // ("€1.1M" would pass: it rounds the running year's €1,089,920, a figure of the same result.)
  for (const wrong of ["1.084.500,00 EUR", "1 084 500 €", "€1'084'500", "1084500€", "€1,08 Mio.", "£1,048,000", "€1M"]) {
    assert.deepEqual(unknown(`We claim ${wrong}.`), [wrong], wrong);
  }
  assert.deepEqual(ledger.unknown("Amount: 1,084,500.00 credit", "draft", { labelled: true }).map((a) => a.raw), ["1,084,500.00"]);
  // Scopes: a what-if figure may be narrated, never claimed.
  const apex = new FigureLedger();
  const whatIf = simulateRebate(model, REF["SC-APEX-NAME"].hypothesis);
  const verified = simulateRebate(model, REF["SC-APEX-NAME"].finding);
  apex.addEngine(whatIf); apex.addEngine(verified); apex.setOptionsSource(verified);
  const owedWhatIf = `€${whatIf.years.find((y) => y.year === "AY").owed_eur.toLocaleString("en-GB")}`;
  assert.deepEqual(apex.unknown(`We claim ${owedWhatIf}.`, "draft").map((a) => a.raw), [owedWhatIf]);
  assert.deepEqual(apex.unknown(`The what-if would claim ${owedWhatIf}.`, "narration"), []);
  ok("figure audit: German, Swiss and spaced formats, other currencies and coarse roundings are caught; drafts never quote a what-if");

  // Verified alerts: an unlinked account needs the register and an independent confirmation.
  const log = new EvidenceLog();
  log.note("erp_get_agreement", {}, ERP.erp_get_agreement(model, { agreement_id: "RA-AVGO" }));
  log.note("erp_get_spend", {}, ERP.erp_get_spend(model, { vendor_ids: ["99999"] }));
  const alert = { basis: "verified", vendor_ids: ["50003"], sources: [{ title: "A" }, { title: "B" }] };
  assert.match(verifiedAlertError(model, alert, log), /two kinds of evidence/);
  log.note("erp_get_rebate_report", {}, ERP.erp_get_rebate_report(model, { agreement_id: "RA-AVGO" }));
  assert.match(verifiedAlertError(model, alert, log), /not been checked in the subscription register/);
  log.note("erp_family_tree", {}, ERP.erp_family_tree(model, { vendor_id: "50003" }));
  assert.match(verifiedAlertError(model, alert, log), /rests on the register alone/);
  log.note("open_gleif_parent", {}, { entity: { lei: "549300QDZDZP3SLIME17" }, ultimate_parent: { lei: "549300WV6GIDOZJTV909" } });
  assert.equal(verifiedAlertError(model, alert, log), null);
  assert.match(verifiedAlertError(model, { ...alert, vendor_ids: ["30008"] }, log), /no entry in the subscription register/);
  // A linked account belongs to the group by the vendor master: contract and report suffice.
  const linkedLog = new EvidenceLog();
  linkedLog.note("erp_get_agreement", {}, ERP.erp_get_agreement(model, { agreement_id: "RA-AVGO" }));
  linkedLog.note("erp_get_rebate_report", {}, ERP.erp_get_rebate_report(model, { agreement_id: "RA-AVGO" }));
  assert.equal(verifiedAlertError(model, { ...alert, vendor_ids: ["50001"] }, linkedLog), null);
  ok("verified alerts: two kinds of evidence, the register for unlinked accounts, then GLEIF, Wikidata or the web");

  // Drafts follow the approved option; the summary's outcome follows the decision.
  const msft = simulateRebate(model, REF["SC-MSFT-PY"].finding);
  const v1 = msft.variants.find((v) => v.variant_id === "V1");
  assert.match(draftError({ type: "posting", approved: { id: "V1", letter: "A" }, variant: v1, agreement: model.agreements.get("RA-MSFT") }), /contains no set-off.*RA-MSFT does not allow set-off/);
  assert.equal(draftError({ type: "email", approved: { id: "V1", letter: "A" }, variant: v1 }), null);
  assert.match(draftError({ type: "email", approved: { id: "baseline" }, variant: null }), /accepted the loss/);
  assert.equal(draftError({ type: "memo", approved: { id: "baseline" }, variant: null }), null);
  const linkOnly = simulateRebate(model, REF["SC-AVGO-VMW"].finding).variants.find((v) => v.variant_id === "V3");
  assert.match(draftError({ type: "email", approved: { id: "V3", letter: "C" }, variant: linkOnly }), /no claim, set-off or recovery audit/);
  assert.match(draftError({ type: "email", approved: null }), /follow a human decision/);
  assert.deepEqual(reportOutcome({ requested: undefined, optionsShown: true, approved: { id: "V1" } }), { outcome: "response_decided" });
  assert.match(reportOutcome({ requested: "response_decided", optionsShown: true, approved: { id: "baseline" } }).error, /loss_accepted/);
  assert.match(reportOutcome({ requested: "response_decided", optionsShown: true, approved: null }).error, /waiting for a human decision/);
  assert.deepEqual(reportOutcome({ requested: "no_material_finding", optionsShown: false, approved: null }), { outcome: "no_material_finding" });
  assert.match(reportOutcome({ requested: undefined, optionsShown: false, approved: null }).error, /no decision to report/);
  ok("drafts only of the kinds the approved option contains; the summary's outcome follows the decision");

  // Partial counts, set-off timing, the model-facing names.
  const part = simulateRebate(model, { agreement_id: "RA-AVGO", members: ["50003", "50004"] });
  assert.equal(part.basis, "partial");
  assert.match(part.warnings.join(" "), /leave out the linked accounts 50001, 50002/);
  const cisco = simulateRebate(model, REF["SC-CISCO-MA"].finding);
  const setOff = cisco.variants.find((v) => v.variant_id === "V2");
  assert.deepEqual([setOff.action_types, setOff.set_off_objection_day, setOff.time_to_effect_days], [["set_off", "link_accounts"], 10, 12]);
  const forModel = compactForModel(cisco);
  assert.equal(forModel.baseline.rebate_at_risk_eur, 2137920);
  assert.equal("value_at_risk_eur" in forModel.baseline, false);
  assert.equal(forModel.variants[2].rebate_still_lost_eur, 1089920);
  assert.equal(cisco.assumptions.some((t) => /Value at risk/.test(t)), false);
  ok("partial counts are labelled; set-off waits for the objection period; the model sees rebate names");

  // Dates: a deadline in another year says so; a recorded replay can pin today.
  pinToday("2026-10-14T09:00:00Z");
  assert.equal(shortDate(31), new Date(2026, 9, 14 + 31).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }));
  assert.match(shortDate(396), /2027$/);
  assert.equal(simulateRebate(model, REF["SC-CISCO-MA"].finding).start_date, "2026-10-14");
  pinToday(null);
  ok("dates carry the year when it is not this year; today can be pinned for a recorded replay");
}

console.log(`\nAll ${passed} engine tests passed.`);
