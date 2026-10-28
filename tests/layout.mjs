// Layout checks for projector use:
//   viewports  at 1920×1080, 1600×900, 1536×864, 1366×768 and 1280×720 (idle, the finding during the
//              run, options, outbox, approved with the drawer hidden, and that again with the legend
//              opened by the presenter): no horizontal overflow, header badges never overlap
//              the KPI tiles, the header keeps its height and the control bar stays on one row; on the
//              rebate board nothing leaves the panel and the legend, caption, view buttons, race,
//              account labels and company codes never cover each other; the group stays in view (the
//              constellation, or the band when the drawer leaves the board short) and the race never
//              shows a row cut in half
//   scenarios  the other five scenarios at 1280×720 through the finding, options and outbox, whose
//              longer KPI subtitles must not push the header to a third row, and whose boards follow
//              the board rules above (labels apart, the band, whole race rows); their findings at
//              1600×900 too
//   targets    every visible interactive element is at least 40 px high and wide at 1920×1080, in the
//              main states of a run (idle, intro window, mode dialog, options, outbox, audit, Diagnostics)
// Usage: node tests/layout.mjs [case…]
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { APP_ROOT, outDir, wanted, launchBrowser, serveStatic, SKIP_INTRO } from "./lib/harness.mjs";

const OUT = await outDir("layout");
const { base: BASE, close } = await serveStatic(APP_ROOT, 8766);
const browser = await launchBrowser();
const results = [];

async function newPage(width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(SKIP_INTRO);
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort("blockedbyclient"));
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

/** What covers what on the rebate board (empty when everything has its own place). */
async function boardOverlaps(page) {
  return page.evaluate(() => {
    const board = document.querySelector("#board");
    const B = board.getBoundingClientRect();
    const shown = (el) => el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden" && !el.closest("[hidden]");
    const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
    const hit = (a, b) => a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
    const inside = (a) => a.l >= B.left - 1 && a.r <= B.right + 1 && a.t >= B.top - 1 && a.b <= B.bottom + 1;
    const name = (el) => el.getAttribute("aria-label")?.slice(0, 40) || el.className || el.tagName;
    const out = [];
    const race = document.querySelector("#board .race");
    const legend = [...document.querySelectorAll("#board .legend")].find(shown);
    const caption = document.querySelector("#board .board-caption");
    const tools = document.querySelector("#board .board-tools");
    const codes = [...document.querySelectorAll("#board .codes")].find(shown);
    const labels = [...document.querySelectorAll("#board .constellation:not([hidden]) .acct-label, #board .constellation:not([hidden]) .hub-label")].filter(shown).filter((e) => e.textContent.trim());
    const words = [...document.querySelectorAll("#board .constellation:not([hidden]) .lookalike-label")].filter(shown);
    const dots = [...document.querySelectorAll("#board .constellation:not([hidden]) .acct-hit, #board .constellation:not([hidden]) .hub-btn")].filter(shown);
    if (hit(box(caption), box(tools))) out.push("caption under the view buttons");
    if (shown(race) && race.scrollWidth > race.clientWidth + 1) out.push("the race overflows sideways");
    // The group stays in view: the constellation, or the band under the race, whole and on one line.
    const groupView = board.dataset.view === "group";
    const constellation = document.querySelector("#board .constellation");
    const band = document.querySelector("#board .acct-band");
    if (groupView && !shown(constellation) && !shown(band)) out.push("no group in view");
    if (shown(band)) {
      if (!inside(box(band))) out.push("the band leaves the board");
      if (band.scrollWidth > band.clientWidth + 1) out.push("the band overflows sideways");
      if (shown(race) && hit(box(band), box(race))) out.push("the band under the race");
      if (legend && hit(box(band), box(legend))) out.push("the legend covers the band");
      for (const b of band.querySelectorAll(".band-acct, .band-hub")) if (!inside(box(b))) out.push(`${name(b)}: leaves the board`);
    }
    // Whole race rows only: none cut by the card's edge or the board's.
    if (shown(race)) {
      const card = race.getBoundingClientRect();
      for (const row of race.querySelectorAll(".race-row")) {
        if (!shown(row)) continue;
        const r = box(row);
        if (r.b > Math.min(card.bottom, B.bottom) + 1 || r.t < card.top - 1) out.push(`race row ${row.dataset.year} cut`);
      }
    }
    if (legend && shown(race) && hit(box(legend), box(race))) out.push("legend covers the race");
    if (legend && !inside(box(legend))) out.push("legend leaves the board");
    for (const l of labels) {
      const a = box(l);
      const who = l.querySelector("strong")?.textContent || "label";
      if (!inside(a)) out.push(`${who}: label leaves the board`);
      if (legend && hit(a, box(legend))) out.push(`${who}: label under the legend`);
      if (codes && hit(a, box(codes))) out.push(`${who}: label under the company codes`);
      if (shown(race) && hit(a, box(race))) out.push(`${who}: label under the race`);
      for (const w of words) if (hit(a, box(w))) out.push(`${who}: label under the look-alike's struck link`);
    }
    for (const d of dots) {
      if (legend && hit(box(d), box(legend))) out.push(`${name(d)}: under the legend`);
      if (!inside(box(d))) out.push(`${name(d)}: leaves the board`);
    }
    for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
      if (hit(box(labels[i]), box(labels[j]))) out.push(`labels overlap: ${labels[i].querySelector("strong")?.textContent} / ${labels[j].querySelector("strong")?.textContent}`);
    }
    return out;
  });
}

async function toOutbox(page) {
  await page.click('.option-card[data-recommended="true"] [data-action="approve"]');
  await page.waitForFunction(() => /Waiting for your approval of \d+ draft/.test(document.querySelector("#console").innerText), null, { timeout: 120000 });
  await page.waitForTimeout(400);
}

/** Starts a simulation and stops at the finding: the race's chip reads "Verified count". */
async function toFinding(page, scenarioId = null) {
  if (scenarioId) {
    await page.click("#dd-scenario");
    await page.click(`.vc-menu__item[data-id="${scenarioId}"]`);
  }
  await page.click('button[aria-label="Replay speed ×4"]');
  await page.click("#btn-start");
  await page.waitForSelector(".mode-card");
  await page.click('.mode-card[data-mode="simulation"] .mode-cta button');
  await page.waitForFunction(() => [...document.querySelectorAll("#board .race-head .vc-tag, #board .cap-chip")].some((c) => c.textContent === "Verified count"), null, { timeout: 120000 });
  await page.waitForTimeout(1200);
}

async function toOptions(page, scenarioId = null) {
  if (scenarioId) {
    await page.click("#dd-scenario");
    await page.click(`.vc-menu__item[data-id="${scenarioId}"]`);
  }
  await page.click('button[aria-label="Replay speed ×4"]');
  await page.click("#btn-start");
  await page.waitForSelector(".mode-card");
  await page.click('.mode-card[data-mode="simulation"] .mode-cta button');
  await page.waitForSelector('.option-card[data-recommended="true"] [data-action="approve"]', { state: "visible", timeout: 120000 });
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
      const boardIdle = await boardOverlaps(page);
      await page.screenshot({ path: path.join(OUT, `vp-${w}x${h}-idle.png`) });
      await toFinding(page);
      const boardFinding = await boardOverlaps(page);
      await page.screenshot({ path: path.join(OUT, `vp-${w}x${h}-finding.png`) });
      await page.waitForSelector('.option-card[data-recommended="true"] [data-action="approve"]', { state: "visible", timeout: 120000 });
      await page.waitForFunction(() => document.querySelector(".status-pill .text")?.textContent.trim() === "Awaiting your decision", null, { timeout: 30000 });
      await page.waitForTimeout(300);
      const options = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      const headerRun = await headerGeometry(page);
      const boardOptions = await boardOverlaps(page);
      await page.screenshot({ path: path.join(OUT, `vp-${w}x${h}-options.png`) });
      await toOutbox(page);
      const outbox = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      const headerOutbox = await headerGeometry(page);
      const boardOutbox = await boardOverlaps(page);
      await page.screenshot({ path: path.join(OUT, `vp-${w}x${h}-outbox.png`) });
      // The decision on the full board: the drawer hidden, the linked accounts on the ring.
      await page.click('.drawer button:has-text("Hide")');
      await page.waitForTimeout(1600);
      const boardApproved = await boardOverlaps(page);
      await page.screenshot({ path: path.join(OUT, `vp-${w}x${h}-approved.png`) });
      // The presenter opens the legend: the board makes room for it (it never covers the group).
      if (await page.$eval("#board .legend", (l) => l.dataset.collapsed === "true")) await page.click("#board .legend .legend-head button");
      await page.waitForTimeout(1300);
      const boardLegend = await boardOverlaps(page);
      await page.screenshot({ path: path.join(OUT, `vp-${w}x${h}-legend.png`) });
      for (const [label, list] of [["idle", boardIdle], ["finding", boardFinding], ["options", boardOptions], ["outbox", boardOutbox], ["approved", boardApproved], ["legend opened", boardLegend]]) {
        for (const p of list) problems.push(`${label}: board: ${p}`);
      }
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
      await toFinding(page, id);
      const boardFinding = await boardOverlaps(page);
      await page.screenshot({ path: path.join(OUT, `sc-${id}-1280-finding.png`) });
      await page.waitForSelector('.option-card[data-recommended="true"] [data-action="approve"]', { state: "visible", timeout: 120000 });
      await page.waitForFunction(() => document.querySelector(".status-pill .text")?.textContent.trim() === "Awaiting your decision", null, { timeout: 30000 });
      await page.waitForTimeout(300);
      const atOptions = await headerGeometry(page);
      const boardOptions = await boardOverlaps(page);
      await toOutbox(page);
      const atOutbox = await headerGeometry(page);
      const boardOutbox = await boardOverlaps(page);
      await page.screenshot({ path: path.join(OUT, `sc-${id}-1280-outbox.png`) });
      for (const [label, g] of [["options", atOptions], ["outbox", atOutbox]]) {
        if (g.overlap) problems.push(`${id} ${label}: header badges overlap the KPI tiles`);
        if (g.headerHeight > 115) problems.push(`${id} ${label}: header grew to ${g.headerHeight} px`);
      }
      for (const [label, list] of [["finding", boardFinding], ["options", boardOptions], ["outbox", boardOutbox]]) for (const p of list) problems.push(`${id} ${label}: board: ${p}`);
    } catch (e) { problems.push(`${id}: exception: ${String(e.message).split("\n")[0]}`); }
    problems.push(...errors.map((e) => `${id}: page error: ${e}`));
    await context.close();
  }
  // Their findings at 1600×900, where the ring is larger and its labels wider.
  for (const id of ["SC-MSFT-PY", "SC-APEX-NAME", "SC-AVGO-VMW", "SC-SCHN-AVEVA", "SC-CRM-FX"]) {
    const { context, page, errors } = await newPage(1600, 900);
    try {
      await toFinding(page, id);
      for (const p of await boardOverlaps(page)) problems.push(`${id} finding at 1600×900: board: ${p}`);
      await page.screenshot({ path: path.join(OUT, `sc-${id}-1600-finding.png`) });
    } catch (e) { problems.push(`${id} at 1600×900: exception: ${String(e.message).split("\n")[0]}`); }
    problems.push(...errors.map((e) => `${id}: page error: ${e}`));
    await context.close();
  }
  results.push({ name: "five more scenarios at 1280×720 (finding, options, outbox) and 1600×900 (finding)", ok: !problems.length, problems });
}

if (wanted("targets")) {
  const { context, page, errors } = await newPage(1920, 1080);
  const problems = [];
  const audit = async (label) => {
    // Sizes are taken at rest: entrance animations (a board account scales in) must have finished.
    await page.waitForFunction(() => document.getAnimations().filter((a) => a.effect?.getComputedTiming?.().iterations !== Infinity).every((a) => a.playState !== "running"), null, { timeout: 5000 }).catch(() => {});
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
        if (el.tagName === "A" && el.closest("p, li, .result-sources, .report-card, .md")) continue;
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
    await page.waitForSelector('.option-card[data-recommended="true"] [data-action="approve"]', { state: "visible", timeout: 120000 });
    await page.waitForTimeout(500);
    await audit("options");
    await page.click('.option-card[data-recommended="true"] [data-action="approve"]');
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
