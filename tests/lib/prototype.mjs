// What differs between the prototypes in the shared Vici tests (tests/tokens.mjs, tests/hexagon.mjs and
// tests/page-icon.mjs). Those files are the same in Rebate Hunter, Navigator, Timetable Translator and
// Repack Pilot; this file is the one place that is not. Everything here is Rebate Hunter's.

/** The prototype's name, as on its page and on its card on Victor's website. */
export const NAME = "Rebate Hunter";

/**
 * Colour pairs only this prototype draws (the shared shell's pairs are in tests/tokens.mjs):
 * [what, foreground token, background token, kind]. kind "text" needs 4.5:1, "mark" (a line, an icon,
 * a control's border, a bar) 3:1 (WCAG 2.2, 1.4.3 and 1.4.11). Tokens are Vici's, without "--vc-".
 */
export const COLOUR_PAIRS = [
  // The threshold race: its card (surface), its track (bg), the segments on the track.
  ["Race: what the year-end report counted, on the track", "neutral-solid", "bg", "mark"],
  ["Race: what it missed, on the track", "danger-solid", "bg", "mark"],
  ["Race: a look-alike counted as a what-if, on the track", "feature-solid", "bg", "mark"],
  ["Race: an account's name on what was counted", "neutral-on-solid", "neutral-solid", "text"],
  ["Race: an account's name on what was missed", "danger-on-solid", "danger-solid", "text"],
  ["Race: a rebate tier's line, on the card", "text-muted", "surface", "mark"],
  ["Race: a tier reached, its line, on the card", "text", "surface", "mark"],
  ["Race: a tier's threshold and rate", "text-muted", "surface", "text"],
  ["Race: the first estimate's mark, on the track", "feature-text", "bg", "mark"],
  ["Race: the first estimate's label", "feature-text", "feature-bg", "text"],
  ["Race: the bar's total, on its label", "text", "surface", "text"],
  ["Race: what the report missed, the line under the bar", "danger-text", "surface", "text"],
  ["Race: a year's rebate owed", "danger-text", "surface", "text"],
  ["Race: a year's rebate still at risk", "warning-text", "surface", "text"],
  ["Race: a year's rebate claimed by the option approved", "success-text", "surface", "text"],
  ["Race: what a year is worth, the small print", "text-muted", "surface", "text"],
  // Who belongs: the members table on its card.
  ["Members: an account the report counts, its hexagon", "neutral-solid", "surface", "mark"],
  ["Members: an account the report misses, its hexagon", "danger-solid", "surface", "mark"],
  ["Members: a look-alike in another group, its hexagon", "border-strong", "surface", "mark"],
  ["Members: missed, in the report's column", "danger-text", "surface", "text"],
  ["Members: named in the tip, its tag", "info-text", "info-bg", "text"],
  // The story: the figures at Calculate, the options, the drafts, the bar that asks.
  ["Calculate: the first estimate, struck through", "feature-text", "feature-bg", "text"],
  ["Calculate: the verified count", "danger-text", "danger-bg", "text"],
  ["Calculate: the notes under both, on their tints", "text", "feature-bg", "text"],
  ["Propose: the option approved, on its tint", "on-accent-soft", "accent-soft", "text"],
  ["Propose: the option approved, its frame", "accent", "surface", "mark"],
  ["Propose: the recommended option's letter", "feature-text", "feature-bg", "text"],
  ["Propose: an option not chosen", "text-muted", "bg", "text"],
  ["Prepare: a draft approved, on its tint", "on-accent-soft", "accent-soft", "text"],
  ["The bar that asks: your turn, on its tint", "on-accent-soft", "accent-soft", "text"],
  ["The bar that asks: its frame", "accent", "surface", "mark"],
  ["The bar while the agent works, on lilac", "text", "feature-bg", "text"],
  ["The bar while Play reads: the seconds left", "text-muted", "bg", "text"],
  ["The bar while Play reads: the line that fills", "accent", "bg", "mark"],
  // The key figures on their tints.
  ["A key figure lost if nobody acts: its label and note", "text", "danger-bg", "text"],
  ["A key figure at risk: its label and note", "text", "warning-bg", "text"],
  ["A key figure settled: its label and note", "text", "success-bg", "text"],
  ["The decision clock once you decide", "on-accent-soft", "accent-soft", "text"]
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
 * The hexagon test's tour of the app (tests/hexagon.mjs): the guide, every step of the lead case, its
 * decision and drafts, the end, the case menu and the Start dialog. The page has just been opened, so
 * the guide opens by itself. visit(name, { settle }) checks the page as it is, settle ms (250) after the step.
 */
export async function hexagonTour(page, visit) {
  await page.waitForSelector('html[data-boot="ready"]', { timeout: 20000 });
  await page.waitForSelector("dialog.vc-guide[open]", { timeout: 10000 });
  await visit("the guide, opened by itself");
  await page.click("dialog.vc-guide .vc-guide__rail .vc-step__button >> nth=-1");
  await visit("the guide's talk track");
  await page.keyboard.press("Escape");
  await page.waitForSelector("dialog.vc-guide[open]", { state: "detached", timeout: 5000 }).catch(() => {});
  await page.click("#play");
  for (const [i, id] of ["spot", "check", "calculate", "propose"].entries()) {
    await page.click(`#steps .vc-step:nth-child(${i + 1}) .vc-step__button`);
    await visit(`step ${i + 1}, ${id}`);
  }
  await page.click("#move button.vc-attention");
  await page.waitForFunction(() => document.querySelector("#steps .vc-step--current")?.dataset.step === "prepare", null, { timeout: 15000 });
  await visit("step 5, the drafts waiting");
  await page.click("#move button.vc-attention");
  await page.waitForFunction(() => /^Done\./.test(document.querySelector("#move")?.innerText || ""), null, { timeout: 15000 });
  await page.evaluate(() => document.querySelectorAll("#story details").forEach((d) => { d.open = true; }));
  await visit("the end, the summary and the log open");
  await page.click("#scenario-button");
  await visit("the case menu");
  await page.keyboard.press("Escape");
  await page.click("#start");
  await page.waitForSelector("#start-dialog[open]", { timeout: 5000 });
  await visit("Start agent: simulation or live run");
  await page.keyboard.press("Escape");
}

/**
 * The page icon (tests/page-icon.mjs): the icon and kind of this prototype's card on Victor's website
 * (VictorPflueger/VIP, data/prototypes.js), the colour of that kind's cell (Vici's lilac for a
 * prototype), and favicon.svg exactly: the card's cell drawn for small sizes.
 */
export const PAGE_ICON = {
  icon: "search",
  kind: "prototype",
  tone: "lilac",
  favicon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 103.92">
  <!-- Rebate Hunter's page icon: Vici's search icon in a lilac hexagon cell, the same as its card
       on Victor Pflüger's website (icon and kind: VictorPflueger/VIP, data/prototypes.js). Vici's
       lilac 100 (#f2e9fd) and lilac 900 (#372544); the icon is drawn larger and bolder
       than on the card so that it still reads at 16 px. -->
  <polygon points="120,51.96 90,103.92 30,103.92 0,51.96 30,0 90,0" fill="#f2e9fd"/>
  <g transform="translate(18 9.96) scale(3.5)" fill="none" stroke="#372544" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17 10.4 L13.7 16.12 L7.1 16.12 L3.8 10.4 L7.1 4.68 L13.7 4.68 Z"/>
    <path d="M15.4 15 L20.2 19.8"/>
  </g>
</svg>
`
};
