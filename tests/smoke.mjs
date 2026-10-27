// Smoke tests of the main flows and the failure modes of loading:
//   sim          a full Simulation run (Cisco) with options, outbox, summary and audit export
//   live         key check (401, then accepted), a model that keeps ending its turn early
//   diag         Diagnostics dialog, custom what-if blocks Simulation
//   intro        first visit opens the intro window; "How it works" reopens it; Start agent leads to the mode choice
//   board        the rebate board: the scenario's group view, popovers by keyboard (Escape returns the
//                focus), the portfolio of every agreement opens a group view; nothing loads from outside
//   motion       reduced motion: a Simulation run shows the board's final figures at once, no motion
//   file         opened from file://: the page explains how to start a server
//   missing-data a data file is missing: the boot screen names it
// Usage: node tests/smoke.mjs [case…]
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { APP_ROOT, outDir, wanted, launchBrowser, serveStatic, NETWORK_NOISE, MOCK_KEY, SKIP_INTRO, KEYS } from "./lib/harness.mjs";

const OUT = await outDir("smoke");
const { base: BASE, blockLocal, close } = await serveStatic(APP_ROOT, 8765);
const browser = await launchBrowser();
const results = [];

async function newPage({ anthropic = null, intro = false, viewport = { width: 1920, height: 1080 }, reducedMotion = "no-preference" } = {}) {
  const context = await browser.newContext({ viewport, acceptDownloads: true, reducedMotion });
  if (!intro) await context.addInitScript(SKIP_INTRO);
  await context.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI} ${e.sample || ""}`.trim()));
  });
  const external = [];
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (route) => {
    const u = new URL(route.request().url());
    if (u.host === "api.anthropic.com" && anthropic) return anthropic(route);
    external.push(`${route.request().method()} ${u.host}${u.pathname}`);
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  const log = { pageErrors: [], consoleErrors: [] };
  page.on("pageerror", (e) => log.pageErrors.push(String(e.message || e)));
  page.on("console", (m) => { if (m.type() === "error") log.consoleErrors.push(m.text()); });
  return { context, page, log, external };
}

/** expectations: [[condition, message], …]; allowConsole: console errors that are part of the case. */
async function finish(name, { context, page, log }, checks, expectations, allowConsole = null) {
  const csp = await page.evaluate(() => window.__csp || []).catch(() => ["<page gone>"]);
  const consoleErrors = log.consoleErrors.filter((t) => !NETWORK_NOISE.test(t) && !(allowConsole && allowConsole.test(t)));
  const problems = expectations.filter(([ok]) => !ok).map(([, msg]) => msg);
  if (checks.FAILED) problems.unshift(`exception: ${checks.FAILED}`);
  const ok = !problems.length && !log.pageErrors.length && !consoleErrors.length && !csp.length;
  results.push({ name, ok, problems, checks, pageErrors: log.pageErrors, consoleErrors, csp });
  await context.close();
}

const shot = (page, file) => page.screenshot({ path: path.join(OUT, file) });
const boot = async (page) => { await page.goto(BASE); await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 }); };

// ---- sim: full Cisco simulation ---------------------------------------------------------------
if (wanted("sim")) {
  const t = await newPage();
  const { page } = t;
  const checks = {};
  try {
    await boot(page);
    await page.waitForTimeout(800);
    checks.bootRemoved = (await page.$("#boot")) === null;
    checks.badgeIdle = (await page.textContent("#mode-badge")).trim();
    checks.disclosure = (await page.textContent(".ai-disclosure")).replace(/\s+/g, " ").trim();
    checks.fontsLoaded = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status === "loaded").length; });
    await shot(page, "01-idle.png");
    await page.click('button[aria-label="Replay speed ×4"]');
    await page.click("#btn-start");
    await page.waitForSelector(".mode-card", { timeout: 5000 });
    await shot(page, "02-mode-choice.png");
    await page.click('.mode-card[data-mode="simulation"] .mode-cta button');
    await page.waitForTimeout(2500);
    checks.badgeSim = (await page.textContent("#mode-badge")).trim();
    checks.watermarkVisible = await page.isVisible(".sim-watermark");
    await page.waitForSelector('.option-card[data-recommended="true"] [data-action="approve"]', { state: "visible", timeout: 180000 });
    await page.waitForTimeout(800);
    await shot(page, "03-options.png");
    checks.optionCards = await page.$$eval(".option-card", (els) => els.map((e) => `${e.dataset.kind}:${e.querySelector(".option-total .value")?.textContent}`));
    checks.approveButtonsVisibleWithoutScroll = await page.evaluate(() => {
      const body = document.querySelector(".drawer-body").getBoundingClientRect();
      return [...document.querySelectorAll(".option-actions button")].every((b) => { const r = b.getBoundingClientRect(); return r.top >= body.top && r.bottom <= body.bottom; });
    });
    checks.legendInsideBoard = await page.evaluate(() => {
      const m = document.querySelector("#board").getBoundingClientRect();
      const l = document.querySelector("#board .legend").getBoundingClientRect();
      return getComputedStyle(document.querySelector("#board .legend")).display === "none" || (l.top >= m.top - 1 && l.bottom <= m.bottom + 1);
    });
    await page.click('.option-card[data-recommended="true"] [data-action="approve"]');
    // The board follows the decision: option A links Meraki, Acacia and Splunk, which join the ring
    // (or, while the open drawer leaves the board short, slide into the band's ring), and the closed
    // year shows the claim approved (not "recovered": nothing is booked yet).
    const LINKED = '#board .constellation:not([hidden]) .acct[data-place="ring"], #board .acct-band:not([hidden]) .band-ring .band-acct';
    await page.waitForFunction((sel) => document.querySelectorAll(sel).length === 5, LINKED, { timeout: 15000 });
    checks.boardDecision = await page.evaluate((sel) => ({
      linked: document.querySelectorAll(sel).length,
      ay: document.querySelector('#board .race-row[data-year="AY"] .race-out')?.innerText.replace(/\s+/g, " ")
    }), LINKED);
    await page.waitForSelector('button:has-text("Approve all")', { state: "visible", timeout: 120000 });
    await page.waitForTimeout(600);
    await shot(page, "04-outbox.png");
    checks.drafts = await page.$$eval(".action-card", (els) => els.length);
    await page.click('button:has-text("Approve all")');
    await page.waitForSelector('button:has-text("Open management summary")', { state: "visible", timeout: 120000 });
    await page.waitForFunction(() => /Done/.test(document.querySelector(".status-pill .text")?.textContent || ""), null, { timeout: 60000 });
    await page.waitForTimeout(1000);
    checks.statusEnd = (await page.textContent(".status-pill .text")).trim();
    checks.startLabel = (await page.textContent("#btn-start")).trim();
    checks.lastEntryInView = await page.evaluate(() => {
      const log = document.querySelector("#console .log");
      const last = log.lastElementChild.getBoundingClientRect();
      const box = log.getBoundingClientRect();
      return last.bottom <= box.bottom + 2 && last.top >= box.top - 2;
    });
    checks.replayFacts = await page.$$eval("#console .entry", (els) => /Replay facts:/.test(els.slice(-1)[0]?.textContent || ""));
    await shot(page, "05-done.png");
    await page.click('button:has-text("Open management summary")');
    await page.waitForSelector(".report-modal", { timeout: 5000 });
    checks.reportHasSimNote = (await page.textContent(".report-modal")).includes("Simulated run");
    await shot(page, "06-report.png");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    // A presenter's key stored in this tab must not reach the export, even after a simulation.
    await page.evaluate(async (k) => (await import("./js/keystore.js")).setKey(k), MOCK_KEY);
    await page.click("#tab-audit");
    await page.waitForTimeout(400);
    const [download] = await Promise.all([page.waitForEvent("download"), page.click('button:has-text("Export JSON")')]);
    const audit = JSON.parse(await readFile(await download.path(), "utf8"));
    checks.auditFile = download.suggestedFilename();
    checks.auditMode = audit.mode;
    checks.auditRunFacts = !!audit.run_facts;
    checks.keyStored = await page.evaluate((k) => !!sessionStorage.getItem(k), KEYS.apiKey);
    checks.auditNoKey = checks.keyStored && !JSON.stringify(audit).includes("MOCKKEY") && !JSON.stringify(audit).includes("sk-ant");
  } catch (err) {
    checks.FAILED = String(err.message).split("\n")[0];
    await shot(page, "sim-fail.png");
  }
  await finish("sim: full Simulation run", t, checks, [
    [checks.bootRemoved, "boot screen should be removed"],
    [checks.badgeIdle === "No run active", "idle badge"],
    [/You are interacting with an AI system/.test(checks.disclosure || ""), "AI disclosure must be visible"],
    [checks.badgeSim === "SIMULATION" && checks.watermarkVisible, "SIMULATION badge and watermark"],
    [checks.optionCards?.length === 4 && checks.optionCards.some((c) => c.startsWith("baseline:")), "three options plus do nothing"],
    [checks.approveButtonsVisibleWithoutScroll && checks.legendInsideBoard, "options and legend fit at 1080p"],
    [checks.boardDecision?.linked === 5 && /€1,048,000 option A approved credit note · cash in /.test(checks.boardDecision?.ay || ""), `the board shows the decision (${JSON.stringify(checks.boardDecision)})`],
    [checks.drafts > 0, "approval must produce drafts"],
    [checks.statusEnd === "Done" && checks.startLabel === "New run", "run ends Done"],
    [checks.lastEntryInView && checks.replayFacts, "console ends on the Replay facts line"],
    [checks.reportHasSimNote, "summary marked as simulated"],
    [checks.auditMode === "simulation" && checks.auditRunFacts && checks.auditNoKey, "audit export: simulation mode, run facts, no key"]
  ]);
}

// ---- live: key check and a model that ends its turn early -----------------------------------------
if (wanted("live")) {
  let models = 0;
  let messageCalls = 0;
  const t = await newPage({
    anthropic: async (route) => {
      const req = route.request();
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST" } });
      const cors = { "access-control-allow-origin": "*", "content-type": "application/json" };
      if (req.method() === "POST" && new URL(req.url()).pathname === "/v1/messages") {
        // Ends its turn without finishing the workflow: Rebate Hunter nudges it twice, then stops.
        messageCalls += 1;
        const ev = (e, d) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`;
        const body = [
          ev("message_start", { type: "message_start", message: { id: `msg_${messageCalls}`, model: "claude-sonnet-5-5", role: "assistant", content: [], usage: { input_tokens: 900, output_tokens: 1 } } }),
          ev("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }),
          ev("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Shall I continue with the analysis?" } }),
          ev("content_block_stop", { type: "content_block_stop", index: 0 }),
          ev("message_delta", { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 12 } }),
          ev("message_stop", { type: "message_stop" })
        ].join("");
        return route.fulfill({ status: 200, headers: { ...cors, "content-type": "text/event-stream" }, body });
      }
      models += 1;
      if (models === 1) return route.fulfill({ status: 401, headers: cors, body: JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }) });
      return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ data: [{ id: "claude-sonnet-5-5" }, { id: "claude-haiku-5-5" }, { id: "claude-opus-5-5" }] }) });
    }
  });
  const { page } = t;
  const checks = {};
  try {
    await boot(page);
    await page.click("#btn-start");
    await page.waitForSelector(".mode-card");
    await page.click('.mode-card[data-mode="live"] .mode-cta button');
    await page.waitForSelector("#api-key-input", { timeout: 5000 });
    await page.fill("#api-key-input", MOCK_KEY);
    checks.inputMasked = (await page.getAttribute("#api-key-input", "type")) === "password";
    await shot(page, "10-key-dialog.png");
    await page.click('button:has-text("Check key and continue")');
    await page.waitForFunction(() => /401/.test(document.getElementById("api-key-msg")?.textContent || ""), null, { timeout: 8000 });
    checks.rejectMessage = (await page.textContent("#api-key-msg")).trim();
    await page.click('button:has-text("Check key and continue")');
    await page.waitForSelector("#api-key-input", { state: "detached", timeout: 8000 });
    await page.waitForFunction(() => /Stopped|Done|Error/.test(document.querySelector(".status-pill .text")?.textContent || ""), null, { timeout: 20000 });
    checks.messageCalls = messageCalls;
    checks.nudges = await page.evaluate(() => [...document.querySelectorAll("#console .entry")].filter((e) => /asked it to continue/.test(e.textContent)).length);
    checks.badgeLive = (await page.textContent("#mode-badge")).trim();
    checks.keyInSession = await page.evaluate((k) => Boolean(sessionStorage.getItem(k)), KEYS.apiKey);
    checks.localStorageKeys = await page.evaluate(() => Object.keys(localStorage));
    checks.statusEnd = (await page.textContent(".status-pill .text")).trim();
    checks.keyNotInDom = !(await page.content()).includes("MOCKKEY");
    await shot(page, "11-live-stopped.png");
  } catch (err) {
    checks.FAILED = String(err.message).split("\n")[0];
    await shot(page, "live-fail.png");
  }
  await finish("live: key check and early end", t, checks, [
    [checks.inputMasked, "key input must be masked"],
    [/401/.test(checks.rejectMessage || ""), "a rejected key must say 401"],
    [checks.messageCalls === 3 && checks.nudges === 2, "two nudges, then stop"],
    [checks.statusEnd === "Stopped" && checks.badgeLive === "LIVE", "run ends Stopped in Live mode"],
    [checks.keyInSession && !(checks.localStorageKeys || []).some((k) => /key/i.test(k)) && checks.keyNotInDom, "key in session storage only"]
  ]);
}

// ---- diag: Diagnostics and custom what-if --------------------------------------------------------
if (wanted("diag")) {
  const t = await newPage();
  const { page } = t;
  const checks = {};
  try {
    await boot(page);
    await page.click("#btn-diagnostics");
    await page.waitForFunction(() => document.querySelectorAll('.diag-status[data-s="pass"]').length >= 2, null, { timeout: 10000 });
    await shot(page, "12-diagnostics.png");
    checks.localRows = await page.$$eval(".diag-table tbody tr", (rows) => rows.map((r) => `${r.querySelector("strong")?.textContent}:${r.querySelector(".diag-status")?.dataset.s}`).filter((x) => /World|privacy/.test(x)));
    checks.footer = await page.$eval(".vc-dialog__footer .dialog-note", (e) => e.textContent.trim());
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await page.click("#dd-scenario");
    await page.click('.vc-menu__item[data-id="custom"]');
    await page.waitForSelector("#custom-scenario");
    await page.fill("#custom-scenario", "Slack invoices us from Dublin on its own account. Does it count towards the Salesforce agreement?");
    await page.click('button:has-text("Use this scenario")');
    await page.waitForTimeout(300);
    checks.scenarioLabel = (await page.textContent("#dd-scenario")).replace(/\s+/g, " ").trim();
    await page.click("#btn-start");
    await page.waitForSelector(".mode-card");
    checks.simBlocked = await page.getAttribute('.mode-card[data-mode="simulation"]', "aria-disabled");
    await shot(page, "13-custom-mode.png");
    await page.keyboard.press("Escape");
  } catch (err) {
    checks.FAILED = String(err.message).split("\n")[0];
  }
  await finish("diag: Diagnostics and custom what-if", t, checks, [
    [(checks.localRows || []).length === 2 && checks.localRows.every((x) => x.endsWith(":pass")), "world and privacy rows pass"],
    [/^Rebate Hunter \d+\.\d+\.\d+/.test(checks.footer || ""), "Diagnostics footer shows the version"],
    [/Custom/.test(checks.scenarioLabel || ""), "custom what-if selected"],
    [checks.simBlocked === "true", "custom what-ifs cannot run as Simulation"]
  ]);
}

// ---- intro: first visit opens the intro window; "How it works" reopens it ----------------------------
if (wanted("intro")) {
  const t = await newPage({ intro: true });
  const { page } = t;
  const checks = {};
  try {
    await boot(page);
    await page.waitForSelector(".intro-modal", { timeout: 5000 });
    checks.autoOpened = true;
    checks.title = (await page.textContent(".intro-modal h2")).trim();
    checks.steps = await page.$$eval(".intro-step-title", (els) => els.map((e) => e.textContent));
    checks.values = await page.$$eval(".intro-value strong", (els) => els.map((e) => e.textContent));
    checks.words = await page.$eval(".intro-modal", (e) => e.innerText.split(/\s+/).filter(Boolean).length);
    checks.fits = await page.$eval(".intro-modal", (e) => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
    await page.waitForTimeout(200);
    checks.focus = await page.evaluate(() => document.activeElement?.textContent?.trim());
    await shot(page, "20-intro.png");
    await page.click('.intro-modal .vc-dialog__footer button:has-text("Close")');
    await page.waitForSelector(".intro-modal", { state: "detached", timeout: 3000 });
    checks.flag = await page.evaluate((k) => localStorage.getItem(k), KEYS.introSeen);
    await page.reload();
    await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
    await page.waitForTimeout(800);
    checks.reopenedOnReload = await page.isVisible(".intro-modal");
    checks.buttonLabel = (await page.textContent("#btn-about")).trim();
    await page.click("#btn-about");
    await page.waitForSelector(".intro-modal", { timeout: 3000 });
    await page.keyboard.press("Escape");
    await page.waitForSelector(".intro-modal", { state: "detached", timeout: 3000 });
    await page.click("#btn-about");
    await page.click('.intro-modal .vc-dialog__footer button:has-text("Start agent")');
    await page.waitForSelector(".mode-card", { timeout: 5000 });
    checks.startOpensModeChoice = await page.$$eval(".mode-card", (els) => els.map((e) => e.dataset.mode).join(","));
    // During a run the window only explains: Close is its only button and the run carries on.
    await page.click('.mode-card[data-mode="simulation"] .mode-cta button');
    await page.waitForTimeout(1200);
    await page.click("#btn-about");
    await page.waitForSelector(".intro-modal", { timeout: 3000 });
    checks.duringRunButtons = await page.$$eval(".intro-modal .vc-dialog__footer button", (els) => els.map((e) => e.textContent.trim()));
    await page.keyboard.press("Escape");
    checks.statusAfterClose = (await page.textContent(".status-pill .text")).trim();
    await page.click("#btn-abort");
  } catch (err) {
    checks.FAILED = String(err.message).split("\n")[0];
    await shot(page, "intro-fail.png");
  }
  await finish("intro: first visit, reopen, start", t, checks, [
    [checks.autoOpened && checks.title === "How Rebate Hunter works", "the intro opens by itself on the first visit"],
    [checks.steps?.join(",") === "Spot,Check,Calculate,Propose,Prepare" && checks.values?.length === 3, "five steps and three value points"],
    [checks.words <= 200, `the intro stays brief (${checks.words} words)`],
    [checks.fits, "the intro fits the screen"],
    [checks.focus === "Start agent", "the main button has focus"],
    [checks.flag === "1" && checks.reopenedOnReload === false, "once closed, it does not open again on reload"],
    [checks.buttonLabel === "How it works", "header button labelled How it works"],
    [checks.startOpensModeChoice === "simulation,live", "Start agent in the intro opens the mode choice"],
    [JSON.stringify(checks.duringRunButtons) === '["Close"]' && /Scanning|Diagnosing|Verifying|Simulating|Options/.test(checks.statusAfterClose || ""), "during a run: Close only, and the run carries on"]
  ]);
}

// ---- board: the rebate board by mouse and keyboard ------------------------------------------------------
if (wanted("board")) {
  const t = await newPage();
  const { page, external } = t;
  const checks = {};
  try {
    await boot(page);
    await page.click("#dd-scenario");
    await page.click('.vc-menu__item[data-id="SC-MSFT-PY"]');
    await page.waitForTimeout(800);
    checks.caption = (await page.textContent("#board .board-caption strong")).trim();
    checks.raceYears = await page.$$eval("#board .race-row", (els) => els.map((e) => e.dataset.year).join(","));
    checks.reportChip = (await page.textContent("#board .race-head .vc-tag")).trim();
    checks.accounts = await page.$$eval("#board .acct", (els) => els.map((e) => `${e.dataset.id}:${e.dataset.place}`).sort().join(","));
    await shot(page, "14-board-group.png");
    // Keyboard: the hub opens the register entry; Escape closes it and gives the focus back.
    await page.focus("#board .hub-btn");
    await page.keyboard.press("Enter");
    await page.waitForSelector("#board .board-pop:not([hidden])", { timeout: 3000 });
    checks.popTitle = (await page.textContent("#board .board-pop .pop-title")).trim();
    checks.popFocused = await page.evaluate(() => document.querySelector("#board .board-pop").contains(document.activeElement));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    checks.popClosed = await page.$eval("#board .board-pop", (e) => e.hidden);
    checks.focusBack = await page.evaluate(() => document.activeElement?.classList.contains("hub-btn"));
    // An account outside the ring, then a year of the race: its details open under the race card,
    // with a tip, and never cover the bar they explain.
    await page.click('#board .acct[data-id="20002"] .acct-hit');
    await page.waitForSelector("#board .board-pop:not([hidden])");
    checks.accountPop = (await page.textContent("#board .board-pop")).replace(/\s+/g, " ");
    await page.click('#board .race-row[data-year="PY"]');
    await page.waitForTimeout(200);
    checks.yearPop = (await page.textContent("#board .board-pop .pop-title")).trim();
    checks.yearPopPlace = await page.evaluate(() => {
      const pop = document.querySelector("#board .board-pop").getBoundingClientRect();
      const covers = [...document.querySelectorAll("#board .race-row:not([hidden]) .race-track")].some((t) => {
        const track = t.getBoundingClientRect();
        return !(pop.right <= track.left || pop.left >= track.right || pop.bottom <= track.top || pop.top >= track.bottom);
      });
      return `${document.querySelector("#board .board-pop").dataset.tip || "none"}:${covers ? "covers" : "clear"}`;
    });
    await page.keyboard.press("Escape");
    // Keyboard focus survives a redraw: on a company code, the board redraws as the panel resizes;
    // its popover still gives the focus back.
    await page.focus('#board .code-btn[data-code="CC-1000"]');
    await page.setViewportSize({ width: 1920, height: 1060 });
    await page.waitForTimeout(400);
    checks.codeFocusKept = await page.evaluate(() => document.activeElement?.dataset?.code === "CC-1000");
    await page.keyboard.press("Enter");
    await page.waitForSelector("#board .board-pop:not([hidden])");
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(400);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    checks.codeFocusBack = await page.evaluate(() => document.activeElement?.dataset?.code === "CC-1000");
    // A visible focus ring on the board's own buttons: Vici's ring in the focus colour, an outline on
    // rectangles and a hexagonal ring (::after) on hexagons; their shadows must not hide it.
    await page.keyboard.press("Shift");
    checks.rings = await page.evaluate(() => ["#board .board-tools button", "#board .hub-btn", '#board .code-btn[data-code="CC-1000"]'].map((sel) => {
      const el = document.querySelector(sel);
      el.focus();
      const hex = getComputedStyle(document.documentElement).getPropertyValue("--vc-focus").trim();
      const n = parseInt(hex.slice(1), 16);
      const focus = `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
      const cs = getComputedStyle(el);
      const ring = getComputedStyle(el, "::after");
      const outline = cs.outlineStyle === "solid" && parseFloat(cs.outlineWidth) >= 2 && cs.outlineColor === focus;
      const hexRing = ring.content !== "none" && ring.opacity === "1" && ring.backgroundColor === focus;
      return `${sel}:${outline || hexRing}`;
    }));
    // The portfolio: every agreement, the next claim deadline first; a row opens its group, and the
    // keyboard focus moves into the group.
    await page.click('#board .board-tools button:has-text("Portfolio view")');
    await page.waitForSelector('#board .board-view[data-view="portfolio"]:not([hidden])');
    checks.portfolio = await page.$$eval("#board .pf-row", (els) => els.map((e) => e.dataset.id));
    checks.deadlines = await page.$$eval("#board .pf-deadline strong", (els) => els.map((e) => parseInt(e.textContent, 10)));
    checks.msftYear = (await page.textContent('#board .pf-row[data-id="RA-MSFT"] .pf-year')).trim();
    await shot(page, "15-board-portfolio.png");
    await page.focus('#board .pf-row[data-id="RA-CISCO"]');
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    checks.afterRow = `${await page.$eval("#board", (b) => b.dataset.view)}:${(await page.textContent("#board .board-caption strong")).trim()}`;
    checks.focusAfterRow = await page.evaluate(() => document.activeElement?.classList.contains("hub-btn"));
    // Every board control is at least 40 px; the board's own entities at least 44 px.
    checks.small = await page.evaluate(() => [...document.querySelectorAll("#board button")].filter((b) => b.offsetParent).filter((b) => { const r = b.getBoundingClientRect(); return r.width < 40 || r.height < 40; }).map((b) => b.getAttribute("aria-label") || b.textContent));
    checks.small44 = await page.evaluate(() => [...document.querySelectorAll("#board .acct-hit, #board .hub-btn, #board .code-btn, #board .race-row, #board .pf-row, #board .band-acct, #board .band-hub")].filter((b) => b.offsetParent).filter((b) => { const r = b.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).map((b) => b.getAttribute("aria-label") || b.textContent));
    checks.external = external.slice();
  } catch (err) {
    checks.FAILED = String(err.message).split("\n")[0];
    await shot(page, "board-fail.png");
  }
  const sorted = (xs) => xs.every((x, i) => i === 0 || x >= xs[i - 1]);
  await finish("board: group view, popovers, portfolio", t, checks, [
    [checks.caption === "Microsoft Corporation", "the board opens on the chosen scenario's group"],
    [checks.raceYears === "PY,AY,CY" && checks.reportChip === "Year-end report", `before a run the race shows the report's view of the open years and the current year (${checks.raceYears})`],
    [checks.accounts === "20001:ring,20002:outer", `linked account on the ring, the acquisition outside (${checks.accounts})`],
    [checks.popTitle === "Microsoft Corporation" && checks.popFocused && checks.popClosed && checks.focusBack, "the hub's details open by keyboard, Escape closes them and returns the focus"],
    [/Activision Blizzard/.test(checks.accountPop || "") && /not linked to RA-MSFT/i.test(checks.accountPop || ""), "an outside account says why the report misses it"],
    [/^Look-back year: Microsoft/.test(checks.yearPop || "") && checks.yearPopPlace === "up:clear", `a race row opens its year under the race card, its tip up, every bar in view (${checks.yearPopPlace})`],
    [checks.codeFocusKept && checks.codeFocusBack, "focus survives a redraw, and the popover gives it back after one"],
    [(checks.rings || []).every((r) => r.endsWith(":true")), `the view buttons, the hub and the codes show the focus ring (${checks.rings})`],
    [checks.portfolio?.length === 8 && sorted(checks.deadlines || []), `the portfolio lists all eight agreements, next deadline first (${checks.deadlines})`],
    [checks.msftYear === "look-back year", `Microsoft's row is its look-back year, the one due next (${checks.msftYear})`],
    [checks.afterRow === "group:Cisco Systems, Inc." && checks.focusAfterRow, `a portfolio row opens its group and the focus follows (${checks.afterRow}, ${checks.focusAfterRow})`],
    [(checks.small || []).length === 0, `every board control is at least 40 px (${checks.small})`],
    [(checks.small44 || []).length === 0, `every board entity is at least 44 px (${checks.small44})`],
    [(checks.external || []).length === 0, `nothing loads from outside (${checks.external})`]
  ]);
}

// ---- motion: reduced motion shows the final state at once ---------------------------------------------------
if (wanted("motion")) {
  const t = await newPage({ reducedMotion: "reduce" });
  const { page } = t;
  const checks = {};
  try {
    await boot(page);
    await page.click('button[aria-label="Replay speed ×4"]');
    await page.click("#btn-start");
    await page.waitForSelector(".mode-card");
    await page.click('.mode-card[data-mode="simulation"] .mode-cta button');
    await page.waitForSelector(".option-card", { state: "visible", timeout: 180000 });
    await page.waitForTimeout(300);
    // The figure on the right is final straight away (no count-up), the tiers do not pulse, and no
    // board element animates.
    checks.ay = (await page.textContent('#board .race-row[data-year="AY"] .race-out strong')).trim();
    checks.animations = await page.evaluate(() => document.getAnimations().filter((a) => document.querySelector("#board")?.contains(a.effect?.target)).map((a) => `${a.effect?.target?.className}:${a.animationName || a.constructor.name}`));
    checks.flash = await page.$$eval("#board .flash, #board .cross", (els) => els.length);
    await shot(page, "16-reduced-motion.png");
    await page.click("#btn-abort");
  } catch (err) {
    checks.FAILED = String(err.message).split("\n")[0];
    await shot(page, "motion-fail.png");
  }
  await finish("motion: reduced motion", t, checks, [
    [checks.ay === "€1,048,000", `the race shows the final figure (${checks.ay})`],
    [(checks.animations || []).length === 0 && checks.flash === 0, `no animation on the board (${JSON.stringify(checks.animations)}, ${checks.flash} flashes)`]
  ]);
}

// ---- file: opened from disk ---------------------------------------------------------------------------
if (wanted("file")) {
  const t = await newPage();
  const { page } = t;
  const checks = {};
  try {
    await page.goto(`file://${APP_ROOT}/index.html`);
    await page.waitForTimeout(7000);
    checks.bootPresent = (await page.$("#boot")) !== null;
    checks.helpVisible = await page.evaluate(() => getComputedStyle(document.querySelector(".boot-help")).visibility === "visible");
    await shot(page, "16-file-protocol.png");
  } catch (err) { checks.FAILED = String(err.message).split("\n")[0]; }
  await finish("file: page explains how to start a server", t, checks, [[checks.bootPresent && checks.helpVisible, "boot help visible"]], /blocked by CORS policy|Cross origin requests/);
}

// ---- missing-data: a data file did not deploy ------------------------------------------------------------
if (wanted("missing-data")) {
  blockLocal.add("/data/sim_runs.js");
  const t = await newPage();
  const { page } = t;
  const checks = {};
  try {
    await page.goto(BASE);
    await page.waitForSelector('#boot[data-state="failed"]', { timeout: 15000 });
    checks.detail = (await page.textContent("#boot-detail")).trim();
    await shot(page, "17-missing-data.png");
  } catch (err) { checks.FAILED = String(err.message).split("\n")[0]; }
  blockLocal.delete("/data/sim_runs.js");
  await finish("missing-data: boot screen names the file", t, checks, [[/data\/sim_runs\.js/.test(checks.detail || ""), "missing file named"]], /Start-up failed/);
}

await browser.close();
await close();
await writeFile(path.join(OUT, "smoke-results.json"), JSON.stringify(results, null, 2));
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}`);
  for (const p of r.problems) console.log(`      - ${p}`);
  if (r.pageErrors.length || r.consoleErrors.length || r.csp.length) console.log(`      errors: ${JSON.stringify({ page: r.pageErrors, console: r.consoleErrors, csp: r.csp }).slice(0, 400)}`);
}
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} smoke cases passed. Screenshots: ${OUT}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
