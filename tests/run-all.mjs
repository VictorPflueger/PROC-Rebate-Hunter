// Runs every check in order and prints a summary. The app itself needs none of this.
// Usage: node tests/run-all.mjs                  (all suites)
//        node tests/run-all.mjs unit showcase   (only the named suites)
//        node tests/run-all.mjs --require-vici  (Vici's checks must run: no ViciDesign checkout fails)
import { spawnSync } from "node:child_process";
import path from "node:path";
import { APP_ROOT } from "./lib/harness.mjs";

const SUITES = [
  { id: "tokens", what: "colour system on Vici's tokens, light and dark: contrast, colour-blind separation", file: "tests/tokens.mjs" },
  { id: "page-icon", what: "page icon: favicon, header and loading screen, as on the website's card", file: "tests/page-icon.mjs" },
  { id: "fingerprint", what: "the case intact: engine, tools, agent, data and scripts byte for byte 7.2.0's, with 7.2.0's figures", file: "tests/fingerprint.mjs" },
  { id: "world", what: "the world, the six cases, their reference figures and every script on every path", file: "tools/check_world.mjs" },
  { id: "unit", what: "streaming client, retries, aborts, truncated streams, cost maths", file: "tests/unit.mjs" },
  { id: "engine", what: "legacy data against Python, difflib, golden rebate figures, guardrails, the race's data", file: "tests/engine.mjs" },
  { id: "story", what: "the presenter's words and figures: names for ids, steps, six cases on every path, the lead case, Play's pace, the estimate", file: "tests/story.mjs" },
  { id: "vici", what: "Vici's own checks: guide, byline, writing, AI notice, record ids; every sentence of six cases on every path; vici/ byte for byte", file: "tests/vici.mjs", vici: true },
  { id: "lean", what: "the limits: the cut list, every module used, one stylesheet, the policy, the docs' length", file: "tests/lean.mjs" },
  { id: "docs", what: "the docs say what the page and the engine say: the guide's figures, the tiles, the talk track", file: "tests/docs.mjs" },
  { id: "showcase", what: "the presenter in Chromium: the first screen, Play, Your turn, every case and path, the keep list, layout at two sizes in both themes", file: "tests/showcase.mjs", browser: true, vici: true },
  { id: "hexagon", what: "nothing round: the app's files, and the rendered app in both themes", file: "tests/hexagon.mjs", browser: true },
  { id: "live", what: "a live run against a stand-in API: the key, LIVE and the AI notice, steps following the agent, decisions, cost measured, Stop, a rejected key", file: "tests/live.mjs", browser: true }
];

const REQUIRE = process.argv.includes("--require-vici");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const chosen = SUITES.filter((s) => !only.length || only.includes(s.id));
const summary = [];
// In GitHub Actions a failed suite also becomes an annotation with its FAIL lines, readable in the
// run's summary and through the API without the full log.
const CI = process.env.GITHUB_ACTIONS === "true";
const annotate = (s, out) => {
  const lines = out.split("\n").filter((l) => l.trim());
  const picked = [];
  lines.forEach((l, i) => {
    if (!/^(FAIL|Error|AssertionError|TypeError)|failed|exceeded/i.test(l.trim())) return;
    picked.push(l.trim());
    for (let j = i + 1; j < lines.length && /^\s+(-|at |\S)/.test(lines[j]) && j <= i + 8; j++) picked.push(lines[j].trim());
  });
  const text = (picked.length ? picked : lines.slice(-12).map((l) => l.trim())).join(" ⏎ ").slice(0, 6000);
  console.log(`::error title=${s.id} suite failed::${text}`);
};
for (const s of chosen) {
  console.log(`\n=== ${s.id}: ${s.what} ===`);
  const started = Date.now();
  const r = spawnSync(process.execPath, [path.join(APP_ROOT, s.file), ...(s.vici && REQUIRE ? ["--require-vici"] : [])], { cwd: APP_ROOT, stdio: CI ? ["inherit", "pipe", "pipe"] : "inherit", env: process.env, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (CI) {
    process.stdout.write(r.stdout || "");
    process.stderr.write(r.stderr || "");
    if (r.status !== 0) annotate(s, `${r.stdout || ""}\n${r.stderr || ""}`);
  }
  summary.push({ ...s, ok: r.status === 0, code: r.status, seconds: Math.round((Date.now() - started) / 1000) });
  if (r.status === 2 && s.browser) {
    console.log("Playwright is missing; browser suites are skipped. See tests/README.md.");
    break;
  }
}

console.log("\n=== Summary ===");
for (const s of summary) console.log(`${s.ok ? "PASS" : "FAIL"}  ${s.id.padEnd(11)} ${String(s.seconds).padStart(4)} s  ${s.what}`);
const skipped = chosen.length - summary.length;
if (skipped) console.log(`(${skipped} suite${skipped === 1 ? "" : "s"} not run)`);
const allPassed = summary.length === chosen.length && summary.every((s) => s.ok);
// The success line names a run of every suite (a partial run says so above).
if (allPassed && !only.length) console.log(`ALL SUITES PASSED (${summary.length} of ${SUITES.length})`);
process.exit(allPassed ? 0 : 1);
