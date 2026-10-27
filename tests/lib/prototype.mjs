// What differs between the four prototypes in the shared Vici tests (tests/tokens.mjs,
// tests/hexagon.mjs, tests/page-icon.mjs and tests/vici-files.mjs). Those four files are the same in
// Rebate Hunter, Navigator, Timetable Translator and Repack Pilot; this file is the one place that is
// not. Everything here is Rebate Hunter's.

/** The prototype's name, as on its page and on its card on Victor's website. */
export const NAME = "Rebate Hunter";

/**
 * Colour pairs only this prototype draws (the shared shell's pairs are in tests/tokens.mjs):
 * [what, foreground token, background token, kind]. kind "text" needs 4.5:1, "mark" (a line, an icon,
 * a control's border, a bar) 3:1 (WCAG 2.2, 1.4.3 and 1.4.11). Tokens are Vici's, without "--vc-".
 */
export const COLOUR_PAIRS = [
  // The rebate board: its canvas (bg-sunken), the race card and the popovers (surface).
  ["Rebate missed: an account's outline and its links, on the canvas", "danger-solid", "bg-sunken", "mark"],
  ["At risk: an account's outline and its links, on the canvas", "warning-text", "bg-sunken", "mark"],
  ["Approved or settled: an account's outline and its links, on the canvas", "success-solid", "bg-sunken", "mark"],
  ["The account being checked: its pulse, on the canvas", "info-solid", "bg-sunken", "mark"],
  ["The network at rest: accounts, register links and the ring, on the canvas", "neutral-solid", "bg-sunken", "mark"],
  ["The hub's and the ring's ink on the canvas", "text", "bg-sunken", "mark"],
  ["Account names on the canvas", "text", "bg-sunken", "text"],
  ["Account spend and ids on the canvas", "text-muted", "bg-sunken", "text"],
  ["Why the report misses an account (rebate missed), on the canvas", "danger-text", "bg-sunken", "text"],
  ["Why the report misses an account (at risk), on the canvas", "warning-text", "bg-sunken", "text"],
  ["What an approved option does to an account, on the canvas", "success-text", "bg-sunken", "text"],
  ["The ring's label (Linked to …), on the canvas", "neutral-text", "bg-sunken", "text"],
  ["The mark inside an account where the rebate is missed (a cross), on its fill", "danger-text", "danger-border", "mark"],
  ["The mark inside an account at risk (a bar and dot), on its fill", "warning-text", "warning-border", "mark"],
  ["The mark inside an account approved or settled (a tick), on its fill", "success-text", "success-border", "mark"],
  ["Check badges on an account (Register ✓)", "info-text", "info-bg", "text"],
  ["Company codes: GlobalCorp's own sites, in ink", "text", "surface", "text"],
  ["Company codes: their outline", "border-strong", "surface", "mark"],
  ["Race: what the report counted, on the track", "neutral-solid", "surface", "mark"],
  ["Race: what the report missed, on the track", "danger-solid", "surface", "mark"],
  ["Race: what is still lost after a decision, on the track", "warning-text", "surface", "mark"],
  ["Race: what the approved option claims, on the track", "success-solid", "surface", "mark"],
  ["Race: a what-if account, on the track", "feature-solid", "surface", "mark"],
  ["Race: the rebate tiers' ticks", "text-muted", "surface", "mark"],
  ["Race: the figures on the right", "text", "surface", "text"],
  ["Race: a figure that is open (rebate missed)", "danger-text", "surface", "text"],
  ["Race: a figure still at risk", "warning-text", "surface", "text"],
  ["Race: a figure approved or settled", "success-text", "surface", "text"],
  ["Comparison of options: the response cost (fjord), on its track", "info-solid", "bg-subtle", "mark"],
  ["Comparison of options: the rebate still lost, on its track", "warning-text", "bg-subtle", "mark"],
  ["Comparison of options: doing nothing, on its track", "danger-solid", "bg-subtle", "mark"],
  ["Portfolio: the stripe of a row in a state", "danger-solid", "surface", "mark"],
  ["Portfolio: the agreement in focus (ink frame)", "text", "surface", "mark"]
];

/**
 * Colours that must stay apart, beyond the shared ones in tests/tokens.mjs: [what, token, token].
 * The test reports how far apart they stay under colour-vision deficiency; it does not fail on them.
 */
export const SEPARATIONS = [
  ["Race: counted (neutral) vs missed (danger)", "neutral-solid", "danger-solid"],
  ["Race: a what-if account (lilac) vs missed (danger)", "feature-solid", "danger-solid"]
];

/**
 * The hexagon test's tour of the app (tests/hexagon.mjs): the main states of a simulation run, and
 * the dialogs and board views on the way. The page has just been opened, without SKIP_INTRO, so the
 * intro opens by itself. visit(name, { settle }) checks the page as it is, settle ms (250) after the step.
 */
export async function hexagonTour(page, visit) {
  const approve = '.option-card[data-recommended="true"] [data-action="approve"]';
  await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
  await page.waitForSelector(".intro-modal", { timeout: 10000 });
  await visit("start screen with the intro");
  await page.keyboard.press("Escape");
  await page.waitForSelector(".intro-modal", { state: "detached", timeout: 5000 });
  await visit("idle board");
  // The legend opened (if the board folded it), the board's details, and the portfolio before a run.
  const fold = await page.$('#board .legend[data-collapsed="true"] .legend-head button');
  if (fold && (await fold.isVisible())) {
    await fold.click();
    await visit("idle board, legend open");
  }
  await page.click("#board .hub-btn");
  await page.waitForSelector("#board .board-pop:not([hidden])", { timeout: 5000 });
  await visit("details of the supplier group");
  await page.keyboard.press("Escape");
  await page.click('#board .board-tools button:has-text("Portfolio view")');
  await page.waitForSelector('#board .board-view[data-view="portfolio"]:not([hidden])', { timeout: 5000 });
  await visit("portfolio");
  await page.click('#board .board-tools button:has-text("Group view")');
  await page.click("#btn-diagnostics");
  await page.waitForSelector(".diag-table", { timeout: 5000 });
  await visit("diagnostics");
  await page.keyboard.press("Escape");
  await page.waitForSelector(".diag-table", { state: "detached", timeout: 5000 });
  // The mode dialog, the key dialog behind the live card, then a simulation: at ×1 until an account
  // pulses while the agent checks it (a lookup stays open 0.7 s), then at ×4.
  await page.click('button[aria-label="Replay speed ×1"]');
  await page.click("#btn-start");
  await page.waitForSelector(".mode-card", { timeout: 5000 });
  await visit("mode dialog");
  await page.click('.mode-card[data-mode="live"] .mode-cta button');
  await page.waitForSelector("#api-key-input", { timeout: 5000 });
  await visit("key dialog");
  await page.keyboard.press("Escape");
  await page.waitForSelector("#api-key-input", { state: "detached", timeout: 5000 });
  if (!(await page.$(".mode-card"))) await page.click("#btn-start");
  await page.waitForSelector(".mode-card", { timeout: 5000 });
  await page.click('.mode-card[data-mode="simulation"] .mode-cta button');
  await page.waitForSelector('#board [data-checking="true"]', { state: "attached", timeout: 90000 });
  await visit("an account being checked", { settle: 50 });
  await page.click('button[aria-label="Replay speed ×4"]');
  await page.waitForSelector(approve, { state: "visible", timeout: 180000 });
  await page.waitForTimeout(800);
  await visit("decision");
  await page.click(approve);
  await page.waitForSelector('button:has-text("Approve all")', { state: "visible", timeout: 120000 });
  await page.waitForTimeout(800);
  await visit("drafts");
  await page.click('button:has-text("Approve all")');
  await page.waitForFunction(() => /Done/.test(document.querySelector(".status-pill .text")?.textContent || ""), null, { timeout: 60000 });
  await page.waitForTimeout(800);
  await visit("finished");
  await page.click("#tab-audit");
  await visit("finished, audit");
  // The drawer hidden: the group on its ring, the accounts the decision linked on it.
  await page.click(".drawer-toggle");
  await page.waitForTimeout(1500);
  await visit("finished, drawer hidden");
  await page.click('button:has-text("Open management summary")');
  await page.waitForSelector(".report-modal", { timeout: 5000 });
  await visit("management summary");
  await page.keyboard.press("Escape");
}

