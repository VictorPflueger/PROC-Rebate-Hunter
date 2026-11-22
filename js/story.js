// The five steps and the four key figures, built from a run (js/run.js) and the company data. Every
// figure comes from the engine's results in the run or from the engine itself; this module only
// chooses and words them, through js/plain.js. Pure module: the page renders what it returns, and the
// tests check its words and figures in Node.

import { estimates, STEP_IDS } from "./run.js";
import { raceView, agreementSummary, shortName } from "./board_data.js";
import { claimDeadline } from "./world.js";
import { eur, eurFull, eurSpend, plain, liveWords, list, nicknames, plural, count, capital, days } from "./plain.js";

/** The steps as the talk track names them: what each will do (next) and what the agent does in it (doing). */
export const STEPS = [
  { id: "spot", label: "Spot", hint: "the tip", next: "the agent reads the tip, the agreement and what the year-end report counted", doing: "reading the agreement and the accounts" },
  { id: "check", label: "Check", hint: "who belongs", next: "who really belongs to the supplier group, checked with a second source", doing: "checking who belongs to the group" },
  { id: "calculate", label: "Calculate", hint: "what is owed", next: "an engine, not the AI, counts what is owed and by when", doing: "counting what is owed" },
  { id: "propose", label: "Propose", hint: "your decision", next: "three costed options, and your decision", doing: "costing the options" },
  { id: "prepare", label: "Prepare", hint: "the drafts", next: "the drafts your decision allows, each waiting for you", doing: "drafting what you approved" }
];

const LETTER = (opts) => Object.fromEntries((opts?.options || []).map((o) => [o.id, o.letter]));
const words = (t) => (String(t).match(/\S+/g) || []).length;
const KIND = { email: "Email", posting: "Posting", memo: "Memo" };
/** A case's address word: "cisco-acquisitions". */
export const slugOf = (scenario) => scenario.short.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// What each case is about, in a visitor's words (the data's categories are a buyer's shorthand).
const ABOUT = {
  "SC-CISCO-MA": "Acquired companies that bill on their own accounts",
  "SC-MSFT-PY": "Last year's rebate, missed because Activision bills apart",
  "SC-APEX-NAME": "Look-alike names, and a report that hides a tier",
  "SC-AVGO-VMW": "A supplier statement on the wrong tier",
  "SC-SCHN-AVEVA": "A claim window about to close",
  "SC-CRM-FX": "Invoices in pounds that a euro report leaves out"
};

/** The case menu: each case with what it is about. */
export function caseList(scenarios) {
  return scenarios.map((s) => ({ slug: slugOf(s), title: s.title, short: s.short, hint: ABOUT[s.id] || s.category }));
}

/** A group's or a supplier's name in one breath: "Apex Holding", without the country in brackets. */
const bare = (name) => String(name || "").replace(/\s*\([A-Z]{2}\)$/, "");

/**
 * story({ model, scenario, run, mode }) → { steps[5], kpis, log, ended, finished }
 * run: digest(events) of js/run.js. mode: "simulation" or "live".
 */
export function story({ model, scenario, run, mode = "simulation" }) {
  const a = model.agreements.get(scenario.agreement_id);
  const info = agreementSummary(model, a.id);
  const group = model.groups.get(a.group);
  const who = bare(group?.short || a.short);
  const letters = LETTER(run.options);
  const say = (t) => plain(t, { model, letters });
  const { first, finding } = estimates(run);
  const opts = run.options;
  const decided = run.decision ? (run.decision.option_id === "baseline" ? { id: "baseline", letter: null, title: "Do nothing" } : opts?.options.find((o) => o.id === run.decision.option_id) || null) : null;
  const variant = decided && finding ? finding.variants?.find((v) => v.variant_id === decided.id) || null : null;
  const agent = (i) => [
    ...run.narration.filter((m) => m.step === i).map((m) => ({ kind: "said", text: say(m.text) })),
    ...run.notices.filter((n) => n.step === i && mode === "live").map((n) => ({ kind: "notice", level: n.level, text: liveWords(say(n.text)) }))
  ];
  const pending = run.end ? { kind: "empty", text: "The run stopped before this step." } : { kind: "wait" };
  const steps = [];

  // 1 Spot: the tip, what the agreement pays and what the year-end report did with it.
  const report = raceView(model, a.id, null);
  const ay = report.rows.find((r) => r.year === "AY");
  const shown = ay?.out || {};
  const reportDid = !shown.listed ? `it lists ${a.short} only from ${eurSpend(info.report_min_eur)}, so it filed no claim`
    : shown.rebate_shown_eur > 0 ? `it found ${shown.tier_shown_pct} % on ${eurSpend(ay.total_eur)} and claimed nothing more`
      : `it counted ${eurSpend(ay.total_eur)} for the closed year and filed no claim`;
  steps.push({
    title: scenario.title,
    lead: `A tip, not yet a fact. ${who}'s agreement pays ${tiers(info)}, and the year-end report counts only the accounts linked to it: ${reportDid}.`,
    card: { kind: "tip", text: say(scenario.seed.replace(/^Unverified [^:]+:\s*/, "")), from: tipSource(scenario.seed) },
    stage: { kind: "race", title: `What the year-end report counted for ${who}`, race: report, basis: "report" }
  });

  // 2 Check: who belongs to the group, by the register and a second source.
  const members = membersOf(model, a, run, finding);
  const tipNames = members.filter((x) => x.status !== "linked" && namedIn(scenario.seed, x.name)).map((x) => x.id);
  const found = members.filter((x) => x.status === "register" && !tipNames.includes(x.id));
  const lookalikes = lookalikesOf(model, a, run);
  const alert = run.alert;
  steps.push({
    title: alert ? say(alert.title) : `Who belongs to ${who}?`,
    lead: "Only the subscription register can join an account to a group; a similar name never does. A second, independent source confirms each company it adds.",
    card: alert ? { kind: "alert", what_if: alert.basis === "what_if", summary: say(alert.summary), sources: sourcesOf(run, alert, say) } : (run.calls.some((c) => c.step === 1) ? null : pending),
    stage: members.length ? { kind: "members", title: `Who belongs to ${who}`, members: members.map((x) => ({ ...x, tip: tipNames.includes(x.id), found: found.some((f) => f.id === x.id) })), lookalikes } : pending,
    foundNames: nicknames(model, found.map((x) => x.id))
  });

  // 3 Calculate: the first estimate against the verified count, the closed year against the tiers.
  const firstStake = first?.baseline?.rebate_at_risk_eur ?? null;
  const stake = finding?.baseline?.rebate_at_risk_eur ?? null;
  const yearOf = (res, y) => res?.years?.find((x) => x.year === y) || null;
  const due = finding?.baseline?.first_loss_year || "AY";
  const firstYear = yearOf(first, due) || yearOf(first, "AY");
  const dueYear = yearOf(finding, due);
  const cy = yearOf(finding, "CY");
  const threshold = info.tiers[0]?.from_eur ?? 0;
  const corrected = first && finding && first !== finding && Math.abs((firstStake ?? 0) - (stake ?? 0)) > 0.5;
  const figs = [];
  if (corrected) {
    figs.push({ label: first.basis === "what_if" ? "First estimate, a what-if" : "First estimate", value: eur(firstStake), tone: "estimate",
      note: firstYear ? `${firstNote(model, first, firstYear, threshold, info)}` : "before the check" });
  }
  if (finding) {
    figs.push({ label: corrected ? "Verified count" : "At stake", value: eur(stake), tone: "affected",
      note: dueYear ? `${eurSpend(dueYear.spend_eur)} in ${yearName(due)}: ${dueYear.tier_pct} % is ${eurFull(dueYear.owed_eur)}${dueYear.credited_by_supplier_eur > 0.5 ? `, ${eurFull(dueYear.credited_by_supplier_eur)} already credited` : ""}. The claim lapses in ${days(dueYear.claim_deadline_day)}${cy && cy.open_eur > 0.5 && due !== "CY" ? `, and this year's ${eur(cy.open_eur)} slips the same way` : ""}.` : "" });
  }
  steps.push({
    title: !finding ? "What is owed?" : corrected ? `From ${eur(firstStake)} on the first count to ${eur(stake)} at stake` : `${eur(stake)} at stake if nobody claims`,
    lead: "An engine, not the AI, adds up each year's purchases at the contract's rates, finds the tier reached and what is owed, and when each claim lapses.",
    card: finding ? { kind: "figures", figs } : pending,
    stage: finding ? { kind: "race", title: `${who}'s years against the rebate tiers`, race: raceView(model, a.id, finding), basis: "verified", first: corrected && firstYear ? { year: firstYear.year, spend: firstYear.spend_eur } : null } : pending
  });

  // 4 Propose: three costed options next to doing nothing.
  const rec = opts?.options.find((o) => o.recommended) || null;
  const cards = opts ? [...opts.options.map((o) => ({
    id: o.id, letter: o.letter, title: say(o.title), description: say(o.description), risk: say(o.residual_risk),
    cost: o.response_cost_eur, left: o.residual_var_eur, days: o.time_days, recommended: !!o.recommended,
    state: run.decision?.option_id === o.id ? "approved" : run.rejected.includes(o.id) ? "rejected" : run.decision ? "passed" : "open"
  })), {
    id: "baseline", letter: "–", title: "Do nothing", description: say(opts.baseline?.description || ""), left: opts.baseline?.value_at_risk_eur, firstLoss: opts.baseline?.first_loss_day,
    state: run.decision?.option_id === "baseline" ? "approved" : run.decision ? "passed" : "open"
  }] : [];
  steps.push({
    title: decided ? (decided.id === "baseline" ? "You accepted the loss" : `You approved option ${decided.letter}: ${say(decided.title).replace(/^./, (c) => c.toLowerCase())}`)
      : rec ? `Option ${rec.letter} for ${eur(rec.response_cost_eur)} ${rec.residual_var_eur > 0.5 ? `leaves ${eur(rec.residual_var_eur)} lost` : `claims all ${eur(stake ?? rec.recovered_eur)}`}` : "Three options, and you decide",
    lead: decided ? (decided.id === "baseline" ? `Nothing goes to ${who}, and ${eur(stake)} lapses with the claims.` : `The claim is approved. The rebate counts as recovered once ${who} pays.`)
      : "The engine works out what each option costs and recovers. The agent recommends the one with the lowest expected total, and you decide.",
    card: opts ? null : pending,
    stage: opts ? { kind: "options", title: "Three options next to doing nothing", cards } : pending
  });

  // 5 Prepare: the drafts the decision allows, each waiting for a person, then the agent's summary.
  const drafts = run.drafts.map((d) => ({ id: d.action_id, kind: KIND[d.type] || "Draft", type: d.type, to: say(d.recipient), subject: say(d.subject), body: say(d.body), status: d.status || "pending" }));
  const open = drafts.filter((d) => d.status === "pending").length;
  steps.push({
    title: !decided ? "The drafts follow your decision" : !drafts.length ? "The agent is drafting" : open ? `${capital(count(open))} ${open === 1 ? "draft waits" : "drafts wait"} for your approval`
      : `${approvedTitle(drafts)}, nothing sent`,
    lead: !decided ? "Approve an option in step 4, and the agent drafts what it allows." : "The agent drafts only what your decision allows. Approving clears a draft for a person to send; nothing leaves this page.",
    card: decided ? { kind: "drafts", drafts, summary: run.summary && !open ? summaryOf(run.summary.markdown, drafts, say) : null } : { kind: "empty", text: "No decision yet: the agent drafts only for an option you approve." },
    stage: finding ? { kind: "race", title: `${who}'s years against the rebate tiers`, race: raceView(model, a.id, finding), basis: "verified", decision: decisionYears(decided, variant) } : pending
  });

  // Where the page waits for the person, the step says so (waits) and what to do (turn).
  const waits = [false, false, false, !!opts && !decided, !!decided && open > 0];
  const turns = [null, null, null,
    rec ? `The agent recommends option ${rec.letter}: ${eur(rec.response_cost_eur)} to claim ${rec.residual_var_eur > 0.5 ? `all but ${eur(rec.residual_var_eur)}` : `all ${eur(stake ?? rec.recovered_eur)}`}. Approve it, or pick another option.` : "Approve one of the options, or accept the loss.",
    open > 1 ? `${capital(count(open))} drafts wait for you. Approving sends nothing.` : "One draft waits for you. Approving sends nothing."];
  steps.forEach((s, i) => Object.assign(s, STEPS[i], { agent: agent(i), ready: ready(i), waits: waits[i], turn: waits[i] ? turns[i] : null }));
  // Once the drafts are there, they are the agent's words at Prepare; its note that it is drafting goes.
  if (drafts.length) steps[4].agent = steps[4].agent.filter((x) => x.kind === "notice");
  if (rec && !decided && run.rejected.includes(rec.id)) steps[3].turn = "Approve one of the other options, or accept the loss.";
  // How long Play stays on a step: the time to read its title and lead, between 7 and 14 seconds.
  for (const s of steps) s.read = Math.min(14000, Math.max(7000, 3000 + 230 * words(`${s.title} ${s.lead}`)));
  // While a tool runs the step says what Claude is doing; not while the page waits for the person.
  if (mode === "live" && run.working && !run.end && !waits.some(Boolean) && !/^ui_(propose_options|await_)/.test(run.working.name)) steps[Math.min(run.reached, 4)].working = STEPS[Math.min(run.reached, 4)].doing;

  // A step opens once the run has come that far; the drafts open with the decision, so Next never passes
  // a decision still open.
  function ready(i) {
    return i <= run.reached || (i === 4 && !!decided) || !!run.end;
  }

  const ended = run.end && !["done", "no_findings"].includes(run.end.status) && mode === "live" ? { status: run.end.status, text: liveWords(say(run.end.reason || "")) } : null;
  return { case: { id: scenario.id, title: scenario.title, who }, steps, kpis: kpis(), log: logOf(run, cards, say), ended, decided: !!decided, finished: !!run.summary || !!run.end };

  function kpis() {
    const base = finding?.baseline || null;
    const atStake = base ? base.rebate_at_risk_eur ?? base.value_at_risk_eur : null;
    const firstDay = base?.first_loss_day ?? null;
    const label = base?.first_loss_year ? `for ${yearName(base.first_loss_year)}` : `${who}'s claim`;
    const out = { stake: null, deadline: null, clockNote: decided ? "stopped at your decision" : "running since the tip" };
    if (!base) {
      const counting = mode === "live" ? { value: "Step 3", note: "the agent is counting", tone: "muted" } : null;
      return { ...out, stake: counting, deadline: counting };
    }
    if (decided?.id === "baseline") {
      out.stake = { value: eur(atStake), note: "you accepted the loss", tone: "affected" };
      out.deadline = { value: days(firstDay), note: label, tone: "affected" };
    } else if (decided) {
      const left = decided.residual_var_eur ?? 0;
      out.stake = { value: eur(left), was: eur(atStake), note: left > 0.5 ? `left with option ${decided.letter}` : `claimed with option ${decided.letter}`, tone: left > 0.5 ? "at_risk" : "resolved" };
      const after = decided.first_loss_day ?? null;
      out.deadline = after === null
        ? { value: "None", was: days(firstDay), note: `option ${decided.letter} claims in time`, tone: "resolved" }
        : { value: days(after), was: after === firstDay ? null : days(firstDay), note: "the next claim at risk", tone: "at_risk" };
    } else {
      out.stake = { value: eur(atStake), note: "if nobody claims", tone: atStake > 0.5 ? "affected" : "resolved" };
      out.deadline = firstDay === null ? { value: "None", note: "nothing lapses within 400 days", tone: "resolved" } : { value: days(firstDay), note: label, tone: firstDay <= 30 ? "affected" : "at_risk" };
    }
    return out;
  }
}

// ---- helpers ------------------------------------------------------------------------------------------

/** "2 % on the whole year's purchases once they reach €50M"; with several tiers, each from its threshold. */
const tiers = (info) => (info.tiers.length === 1
  ? `${info.tiers[0].rate_pct} % on the whole year's purchases once they reach ${eurSpend(info.tiers[0].from_eur)}`
  : `${list(info.tiers.map((t) => `${t.rate_pct} % from ${eurSpend(t.from_eur)}`))} on the whole year's purchases`);
export const yearName = (y) => ({ AY: "the closed year", PY: "the look-back year", CY: "this year" })[y] || "the year";

/** "a category manager", "the duplicate-vendor check": who sent the tip, from its first words. */
function tipSource(seed) {
  const m = /^Unverified \w+ from ([^:]+):/.exec(seed);
  return m ? m[1] : null;
}

/** True when the tip names the account: a distinctive word of its name appears in the tip. */
function namedIn(seed, name) {
  const s = seed.toLowerCase();
  return shortName(name).toLowerCase().split(/\s+/).filter((w) => w.length > 3 && !/^(software|systems|global|international|solutions|communications|networks|technology|technologies|germany|electric|group|cloud)$/.test(w)).some((w) => s.includes(w));
}

/** The accounts of the agreement's group: linked ones, register members not linked, from the register's answer or the engine's count. */
function membersOf(model, a, run, finding) {
  const byId = new Map();
  for (const id of a.linked) byId.set(id, { id, status: "linked" });
  if (run.tree && run.tree.group?.id === a.group) {
    for (const m of run.tree.members) if (!byId.has(m.vendor_id)) byId.set(m.vendor_id, { id: m.vendor_id, status: "register" });
  }
  for (const m of finding?.members || []) if (!byId.has(m.vendor_id)) byId.set(m.vendor_id, { id: m.vendor_id, status: m.status === "unverified" ? "unverified" : "register" });
  if (!run.tree && !finding) return [];
  const names = nicknames(model, [...byId.keys()]);
  return [...byId.values()].map((x, i) => {
    const v = model.vendors.get(x.id);
    const reg = model.registerByVendor.get(x.id);
    const spend = finding?.members?.find((m) => m.vendor_id === x.id)?.spend_eur?.AY ?? null;
    const cc = model.companyCodes.get(v.company_code);
    return {
      id: x.id, name: shortName(v.name), nick: names[i], status: x.status, place: [v.city, v.country].filter(Boolean).join(", "), billsTo: cc?.short || null,
      since: reg?.relation === "acquired" && reg.since ? reg.since : null, currency: v.currency, spend
    };
  }).sort((p, q) => (p.status === "linked" ? 0 : 1) - (q.status === "linked" ? 0 : 1));
}

/** Look-alikes the duplicate check found that the register puts in another group: never counted. */
function lookalikesOf(model, a, run) {
  const call = [...run.calls].reverse().find((c) => c.name === "erp_find_duplicates" && c.ok && c.result?.candidates);
  if (!call) return [];
  return call.result.candidates.filter((c) => model.registerByVendor.get(c.vendor_id)?.group !== a.group && !a.linked.includes(c.vendor_id)).map((c) => {
    const other = model.groups.get(model.registerByVendor.get(c.vendor_id)?.group);
    return { name: shortName(model.vendors.get(c.vendor_id)?.name || c.name), similarity: c.name_similarity_pct, group: other ? bare(other.short) : null };
  });
}

/** The sources behind an alert: its own list, the web results and the register, without duplicates. */
function sourcesOf(run, alert, say) {
  const out = (alert.sources || []).map((s) => say(String(s.title || "")).replace(/\s*\(representative(?: extract)?\)/, "")).filter(Boolean);
  return [...new Set(out)].slice(0, 5);
}

function firstNote(model, first, y, threshold, info) {
  const counted = (first.members || []).filter((m) => m.status !== "linked").map((m) => m.vendor_id);
  const names = list(nicknames(model, counted));
  const reached = y.tier_pct > 0;
  if (first.basis === "what_if") return `Counting ${names || "the look-alike"} too: ${eurSpend(y.spend_eur)} in ${yearName(y.year)}, if the two were one supplier. The register says they are not.`;
  if (!reached) return `${names ? `With ${names}, ` : ""}${eurSpend(y.spend_eur)} in ${yearName(y.year)}: short of the ${eurSpend(threshold)} threshold, so nothing would be owed.`;
  return `${names ? `With ${names}, ` : ""}${eurSpend(y.spend_eur)} in ${yearName(y.year)}: the ${y.tier_pct} % tier, before every account was checked.`;
}

/** What the approved option does to each year of the race: claimed (when, how) or still lost. */
function decisionYears(decided, variant) {
  if (!decided) return null;
  if (decided.id === "baseline") return { kind: "accepted", label: "Do nothing" };
  const cash = new Map((variant?.cash_in || []).map((c) => [c.year, c]));
  return { kind: "option", label: `Option ${decided.letter}`, years: Object.fromEntries([...cash].map(([y, c]) => [y, { eur: c.amount_eur, day: c.day, via: c.via }])) };
}

/** "Both drafts approved", "The draft approved", "One of two drafts approved". */
function approvedTitle(drafts) {
  const n = drafts.length;
  const a = drafts.filter((d) => d.status === "approved").length;
  if (a === n) return n === 1 ? "The draft approved" : n === 2 ? "Both drafts approved" : `All ${count(n)} drafts approved`;
  return `${capital(count(a))} of ${count(n)} drafts approved`;
}

/** The agent's management summary, with the approvals filled in and no record ids. */
function summaryOf(markdown, drafts, say) {
  const approved = drafts.filter((d) => d.status === "approved").length;
  const md = String(markdown).replace(/\{\{actions\.approved\}\}/g, String(approved)).replace(/\{\{actions\.total\}\}/g, String(drafts.length));
  return say(md).replace(/\n*\*(Simulated run|Live agent run)[^*]*\*\s*$/, "").trim();
}

/** Who approved or rejected what, and when: every decision on the page, in order. */
function logOf(run, cards, say) {
  const title = (id) => cards.find((c) => c.id === id);
  return run.log.map((e) => {
    let what;
    if (e.kind === "option") {
      const c = title(e.option_id);
      what = e.option_id === "baseline" ? (e.decision === "approved" ? "accepted the loss: do nothing" : "rejected doing nothing")
        : `${e.decision} option ${c?.letter || ""}: ${c ? c.title : say(e.option_label || "")}`;
    } else {
      const k = (KIND[e.type] || "draft").toLowerCase();
      what = `${e.decision} the ${k} to ${say(e.recipient || "")}`.replace(/ to $/, "");
    }
    return { at: e.at, who: e.by === "user" || !e.by ? "You" : e.by, what };
  });
}

/** Days until each claim of an agreement lapses, as the engine's world counts them (for the guide). */
export function deadlineDays(model, agreementId, year = "AY") {
  return claimDeadline(model.agreements.get(agreementId), year);
}
export { STEP_IDS };
