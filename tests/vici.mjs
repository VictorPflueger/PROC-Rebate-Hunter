// Vici's own rules, checked with Vici's own functions (Build a prototype, "Check it"): the How it works
// guide and its key figures (guideProblems), the byline (bylineProblems), the Writing guideline's
// checkable patterns (writingProblems), the AI notice of a page that can start a live run
// (aiNoticeProblems) and names, not record ids (recordIdProblems), on the page, on every sentence the
// presenter writes for the six cases along every decision path, and on the docs. Also the page's layout
// from Vici's brief (SIMULATION or LIVE in the header, one sentence and the byline under it) and vici/:
// every file byte for byte as in ViciDesign at the commit vici/README.md and the tests workflow name.
// Node.js only.
//
// Each imported check first fails on a planted control. Prints VICI CONTROLS OK and VICI STANDARDS OK.
// The functions come from a ViciDesign checkout (VICI_DIR, or ../ViciDesign); without one the suite says
// so and passes, unless --require-vici is given or it runs on GitHub Actions.
// Usage: node tests/vici.mjs [--require-vici]
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { pathToFileURL } from "node:url";
import { APP_ROOT, REQUIRE_VICI, viciDir } from "./lib/harness.mjs";

const dir = viciDir();
if (!dir) {
  console.log(`${REQUIRE_VICI ? "FAIL" : "SKIP"}  no ViciDesign checkout in VICI_DIR or next to this repository (../ViciDesign)`);
  process.exit(REQUIRE_VICI ? 1 : 0);
}
const lib = async (file) => import(pathToFileURL(path.join(dir, "scripts", "lib", file)).href);
const { guideProblems } = await lib("guide.mjs");
const { bylineProblems } = await lib("byline.mjs");
const { writingProblems } = await lib("writing.mjs");
const { aiNoticeProblems, canRunLive, AI_NOTICE } = await lib("ai.mjs");
const { recordIdProblems } = await lib("ids.mjs");

const read = (f) => readFileSync(path.join(APP_ROOT, f), "utf8");
const html = read("index.html");
const page = (paragraphs) => `<html lang="en-GB"><body>${paragraphs.map((t) => `<p>${String(t).replace(/</g, "&lt;")}</p>`).join("")}</body></html>`;
const controls = [];
const standards = [];
const control = (ok, what) => controls.push([!!ok, what]);
const check = (ok, what) => standards.push([!!ok, what]);

// The ids the company's data gives its records: accounts, tax ids, agreements, groups, sites, LEIs.
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const f of ["world.js", "scenarios.js", "reference_cases.js", "sim_runs.js"]) vm.runInContext(read(`data/${f}`), sandbox);
const { WORLD, SCENARIOS, REFERENCE_CASES, SIM_RUNS } = sandbox.window;
const IDS = new Set(["KONZS"]);
for (const v of WORLD.vendors) { IDS.add(v.id); if (v.tax_id) IDS.add(v.tax_id); }
for (const x of [...WORLD.agreements, ...WORLD.groups, ...WORLD.company_codes]) IDS.add(x.id);
for (const x of [...WORLD.groups, ...(WORLD.register || [])]) if (x.lei) IDS.add(x.lei);
const ids = [...IDS].map(String).filter((s) => s.length >= 4);

// ---- the checks can fail ----------------------------------------------------------------------------
control(guideProblems(html.replace(/<dialog\b[^>]*vc-guide[\s\S]*?<\/dialog>/, "")).length > 0, "control: guideProblems catches a page without the guide");
control(guideProblems(html.replace('<div class="kpis"', '<p class="vc-stat" data-vc-kpi="Accounts checked">5</p><div class="kpis"')).some((p) => /Accounts checked/.test(p)), "control: guideProblems catches a key figure the How it works chapter never explains");
control(bylineProblems(html.replace(/href="https:\/\/victorpflueger\.github\.io\/VIP\/index\.html"/, 'href="#"')).length > 0, "control: bylineProblems catches a byline without the website link");
control(writingProblems(page(["Cisco pays more — much more."])).length > 0 && writingProblems(page(["A seamless claim."])).length > 0, "control: writingProblems catches an em dash and a stock word");
control(aiNoticeProblems(html.split(AI_NOTICE.en).join("An assistant")).length > 0 && !aiNoticeProblems('<meta http-equiv="Content-Security-Policy" content="connect-src \'none\'"><p>Replay</p>').length, "control: aiNoticeProblems catches a live page that never says it is an AI, and leaves a page that cannot run live alone");
control(recordIdProblems(page(["Vendor 10003 is not linked to RA-CISCO."]), ids).length === 2 && !recordIdProblems(page(["Meraki is not linked to the Cisco agreement."]), ids).length, "control: recordIdProblems catches an account number and an agreement id, and passes their names");

// ---- the page ---------------------------------------------------------------------------------------
const g = guideProblems(html);
check(!g.length, `the guide follows Vici's standard, a row in How it works for each key figure included${g.length ? `: ${g.join("; ")}` : ""}`);
check(/<h2 class="vc-dialog__title" id="guide-title">How the prototype works<\/h2>/.test(html), "the guide is titled How the prototype works");
const kpis = [...html.matchAll(/\bdata-vc-kpi="([^"]+)"/g)].map((m) => m[1]);
check(kpis.join("|") === "Rebate at stake|Claim deadline|Detection → decision|Session cost", `the header marks its four key figures (${kpis.join(", ")})`);
const b = bylineProblems(html);
check(!b.length, `the byline follows Vici's standard${b.length ? `: ${b.join("; ")}` : ""}`);
const w = writingProblems(html);
check(!w.length, `index.html keeps Vici's writing rules${w.length ? `: ${w.join("; ")}` : ""}`);
const a = aiNoticeProblems(html);
check(canRunLive(html) && !a.length, `the page can start a live run and says "${AI_NOTICE.en}"${a.length ? `: ${a.join("; ")}` : ""}`);
const notice = `<span class="vc-tag vc-tag--feature ai-notice"><span class="vc-icon vc-icon--sparkle" aria-hidden="true"></span>${AI_NOTICE.en}</span>`;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
check(new RegExp(`id="start" data-vc-live>[\\s\\S]{0,160}</button>\\s*${esc(notice)}`).test(html), "the AI notice stands in a lilac tag right beside Start agent, which can start a live run");
check(new RegExp(`id="start-live" data-vc-live>[\\s\\S]{0,160}</button>\\s*${esc(notice)}`).test(html), "and beside the live card's own start button");
const r = recordIdProblems(html, ids);
check(!r.length, `the page as written shows no record id${r.length ? `: ${r.join("; ")}` : ""}`);
check(/<html lang="en-GB">/.test(html), 'the page is marked lang="en-GB"');
const header = (html.match(/<header class="app-header">[\s\S]*?<\/header>/) || [""])[0];
check(/<span class="vc-tag vc-tag--lg mode-tag"[^>]*><span id="mode-text">SIMULATION<\/span><\/span>/.test(header) && /"LIVE"/.test(read("js/shell.js")), "the header says SIMULATION, or LIVE during a live run, in capitals");
const strip = (html.match(/<\/header>\s*<div class="intro">([\s\S]*?)<\/div>\s*<nav/) || [])[1] || "";
check(/<p class="intro-text">[^<]{20,180}fictional[^<]*<\/p>/.test(strip) && /class="vc-byline"/.test(strip), "one sentence under the header says what the prototype does and that its data is fictional, beside the byline");
check((html.match(/class="vc-byline"/g) || []).length === 1, "the page carries one byline");

// ---- every sentence the presenter writes, for the six cases along every decision path ----------------
globalThis.WORLD = WORLD;
globalThis.REFERENCE_CASES = REFERENCE_CASES;
const { getModel } = await import("../js/world.js");
const { simulateRebate } = await import("../js/rebate.js");
const { playHeadless } = await import("../js/headless.js");
const { digest } = await import("../js/run.js");
const { story } = await import("../js/story.js");
const model = getModel();
const said = new Set();
const textOf = (x) => (typeof x === "string" ? [x] : Array.isArray(x) ? x.flatMap(textOf) : x && typeof x === "object" ? Object.values(x).flatMap(textOf) : []);
const collect = (v) => {
  for (const s of v.steps) {
    const st = s.stage || {};
    for (const t of [s.title, s.lead, s.turn, s.hint, s.next, st.title, st.text, ...textOf(s.card), ...textOf(s.agent),
      ...(st.members || []).flatMap((m) => [m.name, m.place]), ...(st.lookalikes || []).flatMap((l) => [l.name, l.group]),
      ...(st.cards || []).flatMap((c) => [c.title, c.description, c.risk])]) if (t && String(t).length > 2) said.add(String(t));
  }
  for (const e of v.log) said.add(e.what);
};
let paths = 0;
for (const sc of SCENARIOS) {
  const fin = simulateRebate(model, REFERENCE_CASES[sc.id].finding);
  for (const choice of [...fin.variants.map((x) => x.variant_id), "baseline"]) {
    const events = await playHeadless(SIM_RUNS[sc.id], sc.id, { choose: () => choice });
    const cut = events.findIndex((e) => e.type === "option_decision");
    collect(story({ model, scenario: sc, run: digest(events.slice(0, cut)), mode: "simulation" }));
    collect(story({ model, scenario: sc, run: digest(events), mode: "simulation" }));
    paths += 1;
  }
}
const sentences = [...said];
const ww = writingProblems(page(sentences));
check(!ww.length, `${sentences.length} texts the page writes for ${SCENARIOS.length} cases on ${paths} decision paths keep Vici's writing rules${ww.length ? `: ${ww.join("; ")}` : ""}`);
const rr = recordIdProblems(page(sentences), ids);
check(!rr.length, `and show names, not record ids${rr.length ? `: ${rr.slice(0, 5).join("; ")}` : ""}`);

// ---- the docs ---------------------------------------------------------------------------------------
for (const f of ["README.md", "DEMO_SCRIPT.md", "tests/README.md"]) {
  const md = read(f).replace(/```[\s\S]*?```/g, " ").replace(/`[^`]*`/g, " ");
  const wd = writingProblems(page(md.split(/\n\s*\n/)));
  check(!wd.length, `${f} keeps Vici's writing rules${wd.length ? `: ${wd.join("; ")}` : ""}`);
}

// ---- vici/, byte for byte ---------------------------------------------------------------------------
const note = read("vici/README.md");
const commit = (note.match(/commit \*\*`([0-9a-f]{7,40})`\*\*/) || [])[1];
const workflow = read(".github/workflows/tests.yml");
check(!!commit && new RegExp(`ref: ${commit}[0-9a-f]*\\b`).test(workflow), `vici/README.md names the ViciDesign commit the tests workflow checks out (${commit || "none"})`);
const vici = path.join(APP_ROOT, "vici");
const files = [];
const walk = (d) => { for (const e of readdirSync(d)) { const f = path.join(d, e); if (statSync(f).isDirectory()) walk(f); else files.push(path.relative(vici, f).split(path.sep).join("/")); } };
walk(vici);
const differ = files.filter((f) => f !== "README.md").filter((f) => !existsSync(path.join(dir, f)) || !readFileSync(path.join(dir, f)).equals(readFileSync(path.join(vici, f))));
check(!differ.length, `every file in vici/ is ViciDesign's (${path.relative(APP_ROOT, dir) || dir}) byte for byte${differ.length ? `; differs: ${differ.join(", ")}` : ` (${files.length - 1} files)`}`);

// vici/ holds exactly the files its README lists, and everything the stylesheet loads.
const listed = [...note.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((m) => m[1]);
const glob = (g) => new RegExp(`^${g.split("*").map((x) => x.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*")}$`);
const unlisted = files.filter((f) => f !== "README.md" && !listed.some((g) => glob(g).test(f)));
const absent = listed.filter((g) => !files.some((f) => glob(g).test(f)));
check(listed.length && !unlisted.length && !absent.length, `vici/ holds exactly the ${listed.length} entries its README lists${unlisted.length ? `; not listed: ${unlisted.join(", ")}` : ""}${absent.length ? `; missing: ${absent.join(", ")}` : ""}`);
const css = read("vici/dist/vici.min.css");
const urls = [...new Set([...css.matchAll(/url\(\s*['"]?(?!data:)([^'")]+)['"]?\s*\)/g)].map((m) => m[1]))];
const unresolved = urls.filter((u) => !existsSync(path.join(vici, "dist", u)));
check(!unresolved.length, `every file Vici's stylesheet loads is in vici/ (${urls.length} files${unresolved.length ? `; missing: ${unresolved.join(", ")}` : ""})`);

// ---- report -----------------------------------------------------------------------------------------
for (const [ok, what] of controls) console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
const controlsFailed = controls.filter(([ok]) => !ok).length;
if (controlsFailed) { console.error(`\n${controlsFailed} control(s) did not fail as planted: the checks cannot be trusted.`); process.exit(1); }
console.log("VICI CONTROLS OK\n");
for (const [ok, what] of standards) console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
const failed = standards.filter(([ok]) => !ok).length;
if (failed) { console.error(`\n${failed} of Vici's standards not met.`); process.exit(1); }
console.log("VICI STANDARDS OK");
