// Layout checks for projector use:
//   viewports  at 1920×1080, 1600×900, 1536×864, 1366×768 and 1280×720 (idle, options, outbox): no
//              horizontal overflow, header badges never overlap the KPI tiles, the header keeps its
//              height and the control bar stays on one row
//   scenarios  the other five scenarios at 1280×720 through options and outbox, whose longer KPI
//              subtitles must not push the header to a third row
//   targets    every visible interactive element is at least 40 px high and wide at 1920×1080, in the
//              main states of a run (idle, intro window, mode dialog, options, outbox, audit, Diagnostics)
// Usage: node tests/layout.mjs [case…]
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { APP_ROOT, outDir, wanted, launchBrowser, serveStatic, fulfilLeaflet, SKIP_INTRO } from "./lib/harness.mjs";

const OUT = await outDir("layout");
const { base: BASE, close } = await serveStatic(APP_ROOT, 8766);
const browser = await launchBrowser();
const results = [];

async function newPage(width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(SKIP_INTRO);
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (route) => {
    if (await fulfilLeaflet(route)) return;
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  await page.goto(BASE);
  await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
  return { context, page, errors };
}

async function headerGeometry(page) {
  return page.evaluate(() => {
    const items = [...document.querySelectorAll(".header-badges > *")].map((e) => e.getBoundingClientRect());
    const kpis = document.querySelector("#kpis").getBoundingClientRect();
    return {
      overlap: items.some((r) => r.right > kpis.left - 4 && r.bottom > kpis.top && r.top < kpis.bottom),
      headerHeight: Math.round(document.querySelector(".app-header").getBoundingClientRect().height),
      controlsHeight: Math.round(document.querySelector("#controls").getBoundingClientRect().height)
    };
  });
}

async function toOutbox(page) {
  await page.click('.option-card[data-recommended="true"] .btn-approve');
  await page.waitForFunction(() => /Waiting for your approval of \d+ draft/.test(document.querySelector("#console").innerText), null, { timeout: 120000 });
  await page.waitForTimeout(400);
}

async function toOptions(page, scenarioId = null) {
  if (scenarioId) {
    await page.click("#dd-scenario");
    await page.click(`.menu-item[data-id="${scenarioId}"]`);
  }
  await page.click('button[aria-label="Replay speed ×4"]');
  await page.click("#btn-start");
  await page.waitForSelector(".mode-card");
  await page.click('.mode-card[data-mode="simulation"] .mode-cta button');
  await page.waitForSelector('.option-card[data-recommended="true"] .btn-approve', { state: "visible", timeout: 120000 });
  // The longest status label ("Awaiting your decision") is the one the control bar must fit.
  await page.waitForFunction(() => document.querySelector(".status-pill .text")?.textContent.trim() === "Awaiting your decision", null, { timeout: 30000 });
  await page.waitForTimeout(300);
}

if (wanted("viewports")) {
  for (const [w, h] of [[1920, 1080], [1600, 900], [1536, 864], [1366, 768], [1280, 720]]) {
    const { context, page, errors } = await newPage(w, h);
    const problems = [];
    try {
      const idle = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      const headerIdle = await headerGeometry(page);
      await page.screenshot({ path: path.join(OUT, `vp-${w}x${h}-idle.png`) });
      await toOptions(page);
      const options = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      const headerRun = await headerGeometry(page);
      await page.screenshot({ path: path.join(OUT, `vp-${w}x${h}-options.png`) });
      await toOutbox(page);
      const outbox = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      const headerOutbox = await headerGeometry(page);
      await page.screenshot({ path: path.join(OUT, `vp-${w}x${h}-outbox.png`) });
      if (idle || options || outbox) problems.push(`horizontal overflow (idle ${idle}, options ${options}, outbox ${outbox})`);
      for (const [label, g] of [["idle", headerIdle], ["options", headerRun], ["outbox", headerOutbox]]) {
        if (g.overlap) problems.push(`${label}: header badges overlap the KPI tiles`);
        if (g.headerHeight > 115) problems.push(`${label}: header grew to ${g.headerHeight} px`);
        if (g.controlsHeight > 70) problems.push(`${label}: control bar wraps (${g.controlsHeight} px)`);
      }
    } catch (e) { problems.push(`exception: ${String(e.message).split("\n")[0]}`); }
    problems.push(...errors.map((e) => `page error: ${e}`));
    results.push({ name: `viewport ${w}×${h}`, ok: !problems.length, problems });
    await context.close();
  }
}

if (wanted("scenarios")) {
  const problems = [];
  for (const id of ["SC-MSFT-PY", "SC-APEX-NAME", "SC-AVGO-VMW", "SC-SCHN-AVEVA", "SC-CRM-FX"]) {
    const { context, page, errors } = await newPage(1280, 720);
    try {
      await toOptions(page, id);
      const atOptions = await headerGeometry(page);
      await toOutbox(page);
      const atOutbox = await headerGeometry(page);
      await page.screenshot({ path: path.join(OUT, `sc-${id}-1280-outbox.png`) });
      for (const [label, g] of [["options", atOptions], ["outbox", atOutbox]]) {
        if (g.overlap) problems.push(`${id} ${label}: header badges overlap the KPI tiles`);
        if (g.headerHeight > 115) problems.push(`${id} ${label}: header grew to ${g.headerHeight} px`);
      }
    } catch (e) { problems.push(`${id}: exception: ${String(e.message).split("\n")[0]}`); }
    problems.push(...errors.map((e) => `${id}: page error: ${e}`));
    await context.close();
  }
  results.push({ name: "five more scenarios at 1280×720 (options, outbox)", ok: !problems.length, problems });
}

if (wanted("targets")) {
  const { context, page, errors } = await newPage(1920, 1080);
  const problems = [];
  const audit = async (label) => {
    const small = await page.evaluate(() => {
      const sel = 'button, a[href], input, select, textarea, summary, [role="button"], [role="tab"], [role="menuitemradio"]';
      const out = [];
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none") continue;
        if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
        // Text links inside sentences are exempt: they are part of the prose.
        if (el.tagName === "A" && el.closest("p, li, .result-sources, .leaflet-control-attribution, .report-card, .md")) continue;
        if (r.height < 40 || r.width < 40) out.push(`${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute("aria-label") || el.title || "").trim().slice(0, 30)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
      return [...new Set(out)];
    });
    if (small.length) problems.push(`${label}: ${small.join("; ")}`);
  };
  try {
    await audit("idle");
    await page.click("#btn-about");
    await page.waitForSelector(".intro-modal");
    await audit("intro window");
    await page.keyboard.press("Escape");
    await page.waitForSelector(".intro-modal", { state: "detached" });
    await page.click('button[aria-label="Replay speed ×4"]');
    await page.click("#btn-start");
    await page.waitForSelector(".mode-card");
    await audit("mode dialog");
    await page.click('.mode-card[data-mode="simulation"] .mode-cta button');
    await page.waitForSelector('.option-card[data-recommended="true"] .btn-approve', { state: "visible", timeout: 120000 });
    await page.waitForTimeout(500);
    await audit("options");
    await page.click('.option-card[data-recommended="true"] .btn-approve');
    await page.waitForFunction(() => /Waiting for your approval of \d+ draft/.test(document.querySelector("#console").innerText), null, { timeout: 120000 });
    await audit("outbox");
    await page.click('button:has-text("Approve all")');
    await page.waitForSelector('button:has-text("Open management summary")', { state: "visible", timeout: 60000 });
    await page.click("#tab-audit");
    await page.waitForTimeout(300);
    await audit("audit");
    await page.click("#btn-diagnostics");
    await page.waitForTimeout(500);
    await audit("Diagnostics");
  } catch (e) { problems.push(`exception: ${String(e.message).split("\n")[0]}`); }
  problems.push(...errors.map((e) => `page error: ${e}`));
  results.push({ name: "touch targets ≥ 40 px at 1920×1080", ok: !problems.length, problems });
  await context.close();
}

await browser.close();
await close();
await writeFile(path.join(OUT, "layout-results.json"), JSON.stringify(results, null, 2));
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}`);
  for (const p of r.problems) console.log(`      - ${p}`);
}
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} layout checks passed. Screenshots: ${OUT}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
