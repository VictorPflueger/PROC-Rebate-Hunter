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
