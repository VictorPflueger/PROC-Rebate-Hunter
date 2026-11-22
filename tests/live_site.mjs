// The published site: GitHub Pages serves exactly the files of this checkout, and the simulation plays
// there with no error and no request to any other host. Run after a Pages build (the "live site"
// workflow does this on every Pages build) or by hand.
//   files   the page, its stylesheet, the presenter, the engine, the tools, the world and the scripts as
//           served equal this checkout (Pages caches for up to ten minutes, so it retries for up to
//           twelve)
//   run     the Cisco case: it plays by itself from Spot, €2.14M at stake and 31 days on the tiles, €0
//           on the first count at Calculate, Your turn at the decision with Approve option A marked,
//           both drafts approved, Done and nothing sent; no page error, nothing loaded from another host
//           (up to three runs a minute apart, for a deployment the CDN is still taking up)
// In GitHub Actions every problem is also printed as an annotation (::error / ::warning).
// Usage: node tests/live_site.mjs [url]   (default: the repository's GitHub Pages address; LIVE_URL)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { APP_ROOT, launchBrowser } from "./lib/harness.mjs";

const URL_BASE = (process.argv[2] || process.env.LIVE_URL || "https://victorpflueger.github.io/PROC-Rebate-Hunter/").replace(/\/?$/, "/");
const FILES = ["index.html", "css/app.css", "js/main.js", "js/shell.js", "js/story.js", "js/view.js", "js/plain.js", "js/config.js", "js/rebate.js", "js/tools.js", "vici/dist/vici.min.css", "vici/dist/vici.js", "data/world.js", "data/sim_runs.js"];
const WAIT_MS = Number(process.env.LIVE_WAIT_MS || 12 * 60 * 1000);
const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const problems = [];

// 1. The files as served equal this checkout.
const deadline = Date.now() + WAIT_MS;
let stale = FILES;
while (true) {
  stale = [];
  for (const f of FILES) {
    try {
      const r = await fetch(`${URL_BASE}${f}?t=${Date.now()}`, { cache: "no-store" });
      const body = Buffer.from(await r.arrayBuffer());
      if (!r.ok || sha(body) !== sha(fs.readFileSync(path.join(APP_ROOT, f)))) stale.push(`${f} (${r.status})`);
    } catch (e) {
      stale.push(`${f} (${String(e.message || e).slice(0, 60)})`);
    }
  }
  if (!stale.length || Date.now() > deadline) break;
  console.log(`waiting for the site to serve this checkout: ${stale.join(", ")}`);
  await new Promise((r) => setTimeout(r, 30000));
}
if (stale.length) problems.push(`the site does not serve this checkout: ${stale.join(", ")}`);
else console.log(`PASS  files: ${FILES.length} files as served equal this checkout`);

// 2. The simulation plays there.
const text = (page, sel) => page.locator(sel).innerText().then((t) => t.replace(/\s+/g, " ").trim()).catch(() => "");
async function simulationRun() {
  const found = [];
  const browser = await launchBrowser();
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  const hosts = new Set();
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("request", (r) => { try { hosts.add(new URL(r.url()).host); } catch { /* data: URLs */ } });
  try {
    await page.goto(`${URL_BASE}?guide=0`, { waitUntil: "load" });
    await page.waitForSelector('html[data-boot="ready"]', { timeout: 30000 });
    const playing = await text(page, "#play-text");
    if (playing !== "Pause") found.push(`Play reads "${playing}" on a page opened without a step, so it does not play`);
    const stake = await text(page, '[data-vc-kpi="Rebate at stake"] .kpi-value');
    const deadlineTile = await text(page, '[data-vc-kpi="Claim deadline"] .kpi-value');
    if (stake !== "€2.14M" || deadlineTile !== "31 days") found.push(`the tiles read "${stake}" and "${deadlineTile}"`);
    await page.keyboard.press("3");
    const calc = await text(page, "#story");
    if (!/From €0 on the first count to €2\.14M at stake/.test(calc)) found.push(`Calculate reads "${calc.slice(0, 100)}"`);
    await page.keyboard.press("4");
    await page.waitForSelector("#move button.vc-attention", { timeout: 10000 });
    const turn = await text(page, "#move");
    if (!/^Your turn\./.test(turn) || !/Approve option A/.test(turn)) found.push(`the decision's bar reads "${turn}"`);
    await page.click("#move button.vc-attention");
    await page.waitForFunction(() => document.querySelector("#steps .vc-step--current")?.dataset.step === "prepare", null, { timeout: 30000 });
    await page.waitForSelector("#move button.vc-attention", { timeout: 10000 });
    await page.click("#move button.vc-attention");
    await page.waitForFunction(() => /^Done\./.test(document.querySelector("#move")?.innerText || ""), null, { timeout: 30000 });
    const done = await text(page, "#move");
    if (!/Nothing was sent\./.test(done)) found.push(`the end reads "${done}"`);
  } catch (e) {
    found.push(`the run did not complete: ${String(e.message || e).split("\n")[0]}`);
  }
  const own = new URL(URL_BASE).host;
  const other = [...hosts].filter((h) => h !== own);
  if (other.length) found.push(`requests to other hosts: ${other.join(", ")}`);
  if (errors.length) found.push(`page errors: ${errors.slice(0, 3).join(" | ")}`);
  await browser.close();
  return found;
}

// In GitHub Actions each problem also becomes an annotation, readable without the job log.
const annotate = (level, msg) => { if (process.env.GITHUB_ACTIONS === "true") console.log(`::${level} title=live site::${msg.replace(/\r?\n/g, " ")}`); };

if (!stale.length) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const found = await simulationRun();
    if (!found.length) { console.log(`PASS  run: the Cisco case plays through its five steps on the published site${attempt > 1 ? ` (run ${attempt})` : ""}`); break; }
    if (attempt === 3) { problems.push(...found); break; }
    for (const f of found) { console.log(`WARN  run ${attempt}: ${f}`); annotate("warning", `run ${attempt}: ${f}`); }
    await new Promise((r) => setTimeout(r, Number(process.env.LIVE_RETRY_MS || 60000)));
  }
}

for (const p of problems) annotate("error", p);
for (const p of problems) console.log(`FAIL  ${p}`);
console.log(`${URL_BASE}: ${problems.length} problem${problems.length === 1 ? "" : "s"}.`);
if (!problems.length) console.log("LIVE SITE OK");
process.exit(problems.length ? 1 : 0);
