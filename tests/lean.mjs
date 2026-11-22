// The limits that keep 8.0.0 lean, in Node: what the cut list removed stays out, every module is used,
// one stylesheet of the app's own, the page connects to the model API alone and loads nothing from
// another site, and the docs stay short.
//   cut      no control bar (Live sweep, a model choice, ×1/×2/×4, Abort, Reset, Diagnostics), no console,
//            no drawer (Options, Outbox, Audit), no Group or Portfolio view, in the page or its modules
//   modules  every file in js/ is reached from js/main.js (with the workers it starts), from index.html
//            or from tools/check_world.mjs
//   page     one stylesheet of the app (css/app.css) after Vici's; scripts and styles from this site;
//            connect-src https://api.anthropic.com and nothing else; no link to the repository
//   docs     README.md at most 900 words, DEMO_SCRIPT.md at most 700, tests/README.md; no other document
// Usage: node tests/lean.mjs
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { APP_ROOT } from "./lib/harness.mjs";

const read = (f) => readFileSync(path.join(APP_ROOT, f), "utf8");
const words = (s) => (s.match(/\S+/g) || []).length;
const results = [];
const check = (ok, what) => results.push([!!ok, what]);
const html = read("index.html");
const page = html.replace(/<!--[\s\S]*?-->/g, "");

// ---- cut ------------------------------------------------------------------------------------------------
const GONE = [
  [/Live sweep/i, "Live sweep"], [/×\s?[124]\b/, "replay speed ×1/×2/×4"], [/\bAbort\b/, "Abort"], [/\bReset\b/, "Reset"], [/Diagnostics/, "Diagnostics"],
  [/Agent console|id="console"/i, "the console"], [/id="drawer"|class="drawer\b/, "the drawer"], [/\bOutbox\b/, "the Outbox"], [/Audit log|Export JSON/, "the audit tab"],
  [/Group view|Portfolio/i, "the Group and Portfolio views"], [/<select\b/i, "a model choice"], [/Save run as simulation/, "Save run as simulation"]
];
const appJs = readdirSync(path.join(APP_ROOT, "js")).filter((f) => f.endsWith(".js"));
// The page's own modules (the unchanged engine, agent and tools keep their 7.2.0 comments).
const PAGE = ["main.js", "shell.js", "story.js", "view.js", "plain.js", "run.js", "live.js", "claude.js", "headless.js", "estimate.js", "estimate-worker.js"];
// js/plain.js names the Outbox and Diagnostics only to turn the agent's mentions of them into this page's words.
const found = GONE.filter(([re]) => re.test(page) || PAGE.filter((f) => f !== "plain.js").some((f) => re.test(read(`js/${f}`).replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ""))));
check(!found.length, `the cut list stays out of the page and its modules${found.length ? `: ${found.map((x) => x[1]).join(", ")}` : ""}`);

// ---- modules --------------------------------------------------------------------------------------------
const reached = new Set();
const visit = (f) => {
  if (reached.has(f) || !existsSync(path.join(APP_ROOT, "js", f))) return;
  reached.add(f);
  for (const m of read(`js/${f}`).matchAll(/(?:from\s+|import\(\s*|new\s+URL\(\s*)["']\.\/([\w.-]+\.js)["']/g)) visit(m[1]);
};
visit("main.js");
for (const m of html.matchAll(/src="js\/([\w.-]+\.js)"/g)) visit(m[1]);
for (const m of read("tools/check_world.mjs").matchAll(/js\/([\w.-]+\.js)/g)) visit(m[1]);
const unused = appJs.filter((f) => !reached.has(f));
const lines = appJs.reduce((n, f) => n + read(`js/${f}`).split("\n").length, 0);
check(!unused.length, `every module in js/ is used (${appJs.length} modules, ${lines} lines)${unused.length ? `; unused: ${unused.join(", ")}` : ""}`);
const own = PAGE.reduce((n, f) => n + read(`js/${f}`).split("\n").length, 0);
check(own <= 2000, `the presenter's own modules stay small: ${own} lines in ${PAGE.length} files`);

// ---- page -----------------------------------------------------------------------------------------------
const sheets = [...page.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
check(sheets.join(" ") === "vici/dist/vici.min.css css/app.css", `two stylesheets, Vici's and the app's (${sheets.join(", ")})`);
const css = readdirSync(path.join(APP_ROOT, "css"));
check(css.join(" ") === "app.css", `css/ holds app.css alone (${css.join(", ")})`);
const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/) || [])[1] || "";
const connect = ((csp.match(/connect-src([^;]*)/) || [])[1] || "").trim();
check(connect === "https://api.anthropic.com", `the page may connect to the model API alone (connect-src ${connect})`);
check(["default-src 'self'", "script-src 'self'", "style-src 'self'", "font-src 'self'", "img-src 'self' data:"].every((d) => csp.includes(d)), "scripts, styles, fonts and images come from this site only");
const scripts = [...page.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map((m) => m[1]);
check(scripts.every((s) => !/^https?:/.test(s)), `every script is this site's (${scripts.length})`);
check(!/github\.com\/VictorPflueger\/PROC-Rebate-Hunter|github\.com/i.test(page), "the page does not link to its repository");
const net = appJs.filter((f) => /\bfetch\(/.test(read(`js/${f}`).replace(/\/\/[^\n]*/g, "")));
check(net.every((f) => ["anthropic.js", "opendata.js"].includes(f)), `only the API client and the agent's open-data tools call fetch (${net.join(", ")}); the page's policy refuses the open data`);

// ---- docs -----------------------------------------------------------------------------------------------
const readme = words(read("README.md"));
const demo = words(read("DEMO_SCRIPT.md"));
check(readme <= 900, `README.md has ${readme} words (at most 900)`);
check(demo <= 700, `DEMO_SCRIPT.md has ${demo} words (at most 700)`);
const docs = [];
const walk = (d) => { for (const e of readdirSync(path.join(APP_ROOT, d), { withFileTypes: true })) { if ([".git", "vici", "node_modules"].includes(e.name)) continue; const r = path.join(d, e.name); if (e.isDirectory()) walk(r); else if (e.name.endsWith(".md")) docs.push(path.normalize(r)); } };
walk(".");
const extra = docs.filter((f) => !["README.md", "DEMO_SCRIPT.md", "tests/README.md"].includes(f));
check(!extra.length, `the documents are README.md, DEMO_SCRIPT.md and tests/README.md${extra.length ? `; also ${extra.join(", ")}` : ""}`);

for (const [ok, what] of results) console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
const failed = results.filter(([ok]) => !ok).length;
if (failed) { console.error(`\n${failed} lean check(s) failed.`); process.exit(1); }
console.log("\nLEAN OK");
