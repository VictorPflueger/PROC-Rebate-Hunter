// Plays all six simulation scripts in the browser with different decision paths and checks the
// integrity rules: no unresolved placeholders, SIMULATION markings, no network at all, KPI and
// rebate-board payoff after the decision (approved years green, a year the option covers in part
// amber with what is still lost, accounts an option links gliding onto the ring, an accepted loss
// stays red), audit export marked as simulation.
// Usage: node tests/sims.mjs [scenarioId…]
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { APP_ROOT, ONLY, outDir, launchBrowser, serveStatic, NETWORK_NOISE, SKIP_INTRO } from "./lib/harness.mjs";

const OUT = await outDir("sims");
const { base: BASE, close } = await serveStatic(APP_ROOT, 8768);
const browser = await launchBrowser();

// Decision plans: options to reject (in order) before the final decision, and draft decisions.
const PLANS = {
  "SC-CISCO-MA": { reject: ["V3"], approve: "V1", drafts: "reject-last" },
  "SC-MSFT-PY": { reject: [], approve: "V1", drafts: "approve-all" },
  "SC-APEX-NAME": { reject: ["V1"], approve: "V2", drafts: "approve-all" },
  "SC-AVGO-VMW": { reject: [], approve: "baseline", drafts: "approve-all" },
  "SC-SCHN-AVEVA": { reject: ["V1", "V2", "V3"], approve: "baseline", drafts: "approve-all" },
  "SC-CRM-FX": { reject: ["V3"], approve: "V2", drafts: "reject-last" }
};

const results = [];
for (const [id, plan] of Object.entries(PLANS)) {
  if (ONLY.length && !ONLY.includes(id)) continue;
  results.push(await playScenario(id, plan));
}
await writeFile(path.join(OUT, "sims-results.json"), JSON.stringify(results, null, 2));
for (const r of results) {
  console.log(`\n# ${r.id}: ${r.ok ? "PASS" : "FAIL"}`);
  for (const [k, v] of Object.entries(r.checks)) console.log(`  ${k}: ${JSON.stringify(v)}`);
  if (r.problems.length) console.log("  PROBLEMS:", r.problems);
  console.log(`  pageErrors: ${JSON.stringify(r.pageErrors)} consoleErrors: ${JSON.stringify(r.consoleErrors)} csp: ${JSON.stringify(r.csp)} network: ${JSON.stringify(r.network)}`);
}
await browser.close();
await close();
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} simulations passed. Screenshots: ${OUT}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);

async function playScenario(id, plan) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, acceptDownloads: true });
  await context.addInitScript(SKIP_INTRO);
  await context.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  const network = [];
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (route) => {
    const u = new URL(route.request().url());
    network.push(`${route.request().method()} ${u.host}${u.pathname}`);
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  const pageErrors = [], consoleErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e.message || e)));
  page.on("console", (m) => { if (m.type() === "error" && !NETWORK_NOISE.test(m.text())) consoleErrors.push(m.text()); });
  const checks = {};
  const problems = [];
  const short = id.replace("SC-", "").toLowerCase();
  try {
    await page.goto(BASE);
    await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
    await page.click('button[aria-label="Replay speed ×4"]');
    // pick the scenario
    await page.click("#dd-scenario");
    await page.click(`.vc-menu__item[data-id="${id}"]`);
    await page.click("#btn-start");
    await page.waitForSelector(".mode-card", { timeout: 5000 });
    await page.click('.mode-card[data-mode="simulation"] .mode-cta button');
    await page.waitForTimeout(1500);
    checks.badge = (await page.textContent("#mode-badge")).trim();
    checks.watermark = await page.isVisible(".sim-watermark");
    const t0 = Date.now();
    await page.waitForSelector('.option-card[data-recommended="true"] [data-action="approve"]', { state: "visible", timeout: 240000 });
    checks.secondsToOptions = Math.round((Date.now() - t0) / 1000);
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, `${short}-1-options.png`) });
    checks.options = await page.$$eval(".option-card", (els) => els.map((e) => `${e.querySelector(".option-letter")?.textContent}:${e.querySelector(".option-total .value")?.textContent}`));
    checks.kpiBefore = await page.$$eval(".kpi", (els) => els.slice(0, 2).map((e) => `${e.dataset.tone}|${e.innerText.replace(/\s+/g, " ").trim()}`));
    const letterOf = (v) => ({ V1: "A", V2: "B", V3: "C" }[v]);
    for (const v of plan.reject) {
      const n0 = await page.$$eval(".entry", (els) => els.length);
      await page.click(`.option-card[aria-label^="Option ${letterOf(v)}:"] [data-action="reject"]`);
      await page.waitForFunction((n) => document.querySelectorAll(".entry").length > n + 1, n0, { timeout: 30000 });
      await page.waitForTimeout(400);
    }
    if (plan.approve === "baseline") {
      await page.click('.option-card[data-kind="baseline"] .option-actions button');
    } else {
      await page.click(`.option-card[aria-label^="Option ${letterOf(plan.approve)}:"] [data-action="approve"]`);
    }
    await page.waitForTimeout(1500);
    checks.kpiAfter = await page.$$eval(".kpi", (els) => els.slice(0, 3).map((e) => `${e.dataset.tone}|${e.innerText.replace(/\s+/g, " ").trim()}`));
    // The board after the decision, whichever way it is drawn (the constellation, or the band of
    // accounts while the drawer leaves it short).
    Object.assign(checks, await page.evaluate(() => {
      const shown = (sel) => [...document.querySelectorAll(`#board .constellation:not([hidden]) ${sel}, #board .acct-band:not([hidden]) ${sel.replace(".acct", ".band-acct")}`)];
      return {
        accountsResolved: shown('.acct[data-state="resolved"]').length,
        boardAtRisk: shown('.acct[data-state="at_risk"]').length + document.querySelectorAll('#board .hub[data-state="at_risk"], #board .race-seg[data-state="at_risk"], #board .race-out[data-tone="at_risk"]').length,
        race: [...document.querySelectorAll("#board .race-row")].map((r) => `${r.dataset.year}:${r.querySelector(".race-out").dataset.tone}:${r.querySelector(".race-out").innerText.replace(/\s+/g, " ").trim()}`)
      };
    }));
    // drafts
    await page.waitForSelector(".action-card[data-status='pending']", { timeout: 120000 });
    await page.waitForFunction(() => /Waiting for your approval of \d+ draft/.test(document.querySelector("#console").innerText), null, { timeout: 120000 });
    await page.screenshot({ path: path.join(OUT, `${short}-2-outbox.png`) });
    const pending = await page.$$(".action-card[data-status='pending']");
    checks.drafts = pending.length;
    for (let i = 0; i < pending.length; i++) {
      const cards = await page.$$(".action-card[data-status='pending']");
      const last = i === pending.length - 1;
      const btn = await cards[0].$(plan.drafts === "reject-last" && last && pending.length > 1 ? "[data-action='reject']" : "[data-action='approve']");
      await btn.click();
      await page.waitForTimeout(150);
    }
    await page.waitForSelector('button:has-text("Open management summary")', { state: "visible", timeout: 120000 });
    await page.waitForFunction(() => /Done/.test(document.querySelector(".status-pill .text")?.textContent || ""), null, { timeout: 30000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, `${short}-3-done.png`) });
    checks.status = (await page.textContent(".status-pill .text")).trim();
    checks.kpiEnd = await page.$$eval(".kpi", (els) => els.map((e) => `${e.dataset.tone}|${e.innerText.replace(/\s+/g, " ").trim()}`));
    const consoleText = await page.innerText("#console");
    checks.labels = ["Hypothesis:", "Check:", "Confirmed:", "Revised:", "Impact:", "Recommendation:"].filter((l) => consoleText.includes(l));
    checks.phases = [...consoleText.matchAll(/Phase: ([A-Za-z ]+)/g)].map((m) => m[1].trim());
    checks.representativeSources = (consoleText.match(/\(representative\)/g) || []).length;
    // report modal
    await page.click('button:has-text("Open management summary")');
    await page.waitForSelector(".report-modal", { timeout: 5000 });
    const reportText = await page.innerText(".report-modal");
    checks.reportHead = reportText.split("\n").filter(Boolean).slice(0, 2).join(" | ");
    checks.reportMarked = /Simulated run/.test(reportText);
    await page.screenshot({ path: path.join(OUT, `${short}-4-report.png`) });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    // outbox text
    const outboxText = await page.$eval("#panel-outbox", (el) => el.textContent);
    // unresolved placeholders anywhere
    const all = `${consoleText}\n${reportText}\n${outboxText}\n${await page.innerText("header")}`;
    const unresolved = all.match(/\{\{[^}]*\}\}/g);
    if (unresolved) problems.push(`unresolved placeholders: ${[...new Set(unresolved)].join(", ")}`);
    if (/Live agent run/.test(all)) problems.push("text claims a live run");
    // audit export
    await page.click("#tab-audit");
    await page.waitForTimeout(300);
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 5000 }), page.click('button:has-text("Export JSON")')]);
    const audit = JSON.parse(await readFile(await dl.path(), "utf8"));
    checks.auditMode = audit.mode;
    checks.auditSaveDisabled = await page.$eval('button:has-text("Save run as simulation")', (b) => b.getAttribute("aria-disabled"));
    checks.optionDecisions = audit.events.filter((e) => e.type === "option_decision").map((e) => `${e.payload.decision} ${e.payload.option_id}`);
    checks.actionDecisions = audit.events.filter((e) => e.type === "action_decision").map((e) => e.payload.decision).join(",");
    // The accounts the approved option links sit on the agreement's ring once the drawer is closed.
    const optionsEv = audit.events.filter((e) => e.type === "options").slice(-1)[0];
    const linkedByOption = (optionsEv?.payload.options || []).find((o) => o.id === plan.approve)?.linked_vendor_ids || [];
    // Hiding the drawer gives the constellation back: an account the option links glides onto the
    // ring (its distance from the hub passes through values between outside and the ring).
    const glide = page.evaluate((ids) => new Promise((resolve) => {
      const between = new Set();
      const t0 = performance.now();
      const px = (el, name) => parseFloat(getComputedStyle(el).getPropertyValue(name));
      const step = () => {
        const a = ids.length ? document.querySelector(`#board .constellation:not([hidden]) .acct[data-id="${ids[0]}"]`) : null;
        const hub = document.querySelector("#board .constellation:not([hidden]) .hub");
        if (a && hub) {
          const k = Math.hypot(px(a, "--x") - px(hub, "--x"), px(a, "--y") - px(hub, "--y")) / px(hub, "--ring-r");
          if (k > 1.08 && k < 1.35) between.add(k.toFixed(3));
        }
        if (performance.now() - t0 < 2200) requestAnimationFrame(step); else resolve(between.size);
      };
      requestAnimationFrame(step);
    }), linkedByOption);
    await page.click('.drawer button:has-text("Hide")').catch(() => {});
    checks.glideSteps = await glide;
    await page.waitForTimeout(300);
    checks.ringAfter = await page.$$eval('#board .acct[data-place="ring"]', (els) => els.map((e) => e.dataset.id).sort());
    checks.linkedByOption = linkedByOption;
    await page.screenshot({ path: path.join(OUT, `${short}-5-board.png`) });
    // expectations
    if (checks.badge !== "SIMULATION") problems.push("badge");
    if (!checks.watermark) problems.push("watermark hidden");
    if (checks.status !== "Done") problems.push(`status ${checks.status}`);
    if (checks.auditMode !== "simulation") problems.push("audit mode");
    if (!checks.reportMarked) problems.push("report not marked as simulated");
    for (const l of ["Hypothesis:", "Confirmed:", "Revised:", "Recommendation:"]) if (!checks.labels.includes(l)) problems.push(`missing ${l}`);
    if (network.length) problems.push(`network requests: ${network.join(", ")}`);
    const expectRejected = plan.reject.length;
    if (checks.optionDecisions.filter((d) => d.startsWith("rejected")).length !== expectRejected) problems.push("rejections not recorded");
    if (plan.approve !== "baseline" && !/resolved|at-risk/.test(checks.kpiAfter[0])) problems.push(`VaR tile did not show the payoff: ${checks.kpiAfter[0]}`);
    // The board follows the money: any approval resolves accounts and turns a year green; a full
    // recovery leaves nothing amber; the accounts an option links join the ring; an accepted loss
    // stays red and says so.
    if (plan.approve !== "baseline") {
      // A full recovery resolves the group's accounts; one that leaves rebate lost keeps them amber,
      // except the accounts it links.
      if (/^resolved\|/.test(checks.kpiAfter[0]) && !(checks.accountsResolved > 0)) problems.push("no account turned resolved after a full recovery");
      if (checks.linkedByOption.length && !(checks.accountsResolved >= checks.linkedByOption.length)) problems.push("the accounts the option links are not resolved");
      if (!checks.race.some((r) => /:resolved:.*option [A-C] approved/.test(r))) problems.push(`no year shows the approved claim: ${checks.race.join(" / ")}`);
      if (checks.race.some((r) => /recovered/.test(r))) problems.push(`a year reads "recovered" before any cash: ${checks.race.join(" / ")}`);
      if (/^resolved\|/.test(checks.kpiAfter[0]) && checks.boardAtRisk !== 0) problems.push(`full recovery, but ${checks.boardAtRisk} board entities stay amber`);
      // Some rebate still lost: a year says how much, in amber.
      if (/^at-risk\|/.test(checks.kpiAfter[0]) && !checks.race.some((r) => /:at_risk:€[\d,]+ still lost with option [A-C]/.test(r))) problems.push(`the rebate still lost shows on no year: ${checks.race.join(" / ")}`);
      const offRing = checks.linkedByOption.filter((v) => !checks.ringAfter.includes(v));
      if (offRing.length) problems.push(`accounts the option links are not on the ring: ${offRing.join(", ")}`);
      if (checks.linkedByOption.length && !(checks.glideSteps >= 2)) problems.push(`the linked accounts jump onto the ring instead of gliding (${checks.glideSteps} positions between)`);
    } else if (!checks.race.some((r) => /:affected:.*loss accepted: do nothing/.test(r))) {
      problems.push(`the accepted loss is not shown: ${checks.race.join(" / ")}`);
    }
  } catch (e) {
    problems.push(`exception: ${e.message.split("\n")[0]}`);
    await page.screenshot({ path: path.join(OUT, `${short}-fail.png`) }).catch(() => {});
  }
  const csp = await page.evaluate(() => window.__csp || []).catch(() => []);
  await context.close();
  const ok = !problems.length && !pageErrors.length && !consoleErrors.length && !csp.length;
  return { id, ok, checks, problems, pageErrors, consoleErrors, csp, network: [...new Set(network)] };
}
