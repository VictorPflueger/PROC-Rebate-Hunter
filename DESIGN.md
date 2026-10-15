# Rebate Hunter — design system

How Rebate Hunter looks, why it looks that way, and how to change it without breaking it. Version 7.1.0, 15 October 2026.

Rebate Hunter shares its design system with its sister prototype, the **Navigator** (supply-chain disruptions, version 1.1.0): the same burgundy source colour, the same generated palette value for value, the same type, components, colour grammar and agentic patterns. The logo, the names and the domain words differ, and so does the centrepiece: where the Navigator shows a map of sites and routes, Rebate Hunter shows a **rebate board**, built from the same canvas, floating controls, legend card, popovers and colour grammar (§3). `REVIEW.md` Part 4 lists the parity item by item; this file explains the system as Rebate Hunter uses it.

---

## 1. The brief

- **Burgundy at the centre.** White paper, burgundy for identity, mostly pastel colours (stakeholder direction for the Navigator, 12 October 2026, adopted unchanged).
- **Legible in 60 seconds.** A partner who has never seen the tool should get the point from across a room, on a 1080p projector, often in a lit room: *these accounts belong to one supplier group, the rebate was never claimed, this is what it is worth and when the claim expires.*
- **Agentic.** An AI agent acts on screen. At every moment the viewer must be able to tell who is acting: the agent, or the person who has to decide.

Everything below follows from those three lines.

## 2. Methods, and what each one decided

| Method | Source | What it decided |
|---|---|---|
| Perceptual colour in OKLCH | CSS Color 4; Evil Martians, *OKLCH in CSS* | One generator builds every colour from the brand burgundy. Equal OKLCH lightness means equal visual weight, so tints of different hues line up |
| Functional 12-step scales | Radix Colors, *Understanding the scale* | Each step has one job: 1–2 backgrounds, 3–5 component backgrounds, 6–8 borders, 9–10 solids, 11–12 text |
| Hue harmonisation | Material Color Utilities, `Blend.harmonize` | Supporting hues (the vendor-master slate, blue, violet) turn towards burgundy by half the distance, at most 15° |
| Colour-blind-safe state hues | Okabe & Ito, *Color Universal Design*; Machado, Oliveira & Fernandes (2009) | The red, amber and green of the rebate states are fixed hues, and the build fails if they come too close under simulated colour blindness |
| Design tokens | W3C Design Tokens Format Module 2025.10 | The palette ships as `design/tokens.json` (OKLCH, with hex fallbacks) next to the CSS custom properties |
| Accessibility | WCAG 2.2 | Contrast duties for every pairing, focus ring, target size, no meaning by colour alone |
| Agentic UX patterns | Yocco, *Designing For Agentic AI*, Smashing Magazine, Feb 2026 | The progress rail (intent preview), the handover to the human, the audit trail |
| AI labelling | IBM Carbon for AI; Pickering, *Tooltips & Toggletips* | An **AI** label on the options, drafts and summary the agent wrote, with a short explanation one click away |
| Emphasis | Google, *Expressive Design: Google's UX Research* (Material 3 Expressive) | One emphasised action per moment: colour, size and containment go to the step that needs the person |
| Projection | VUMC Edge for Scholars, *Optimizing Colors for Projected Presentations* | Pastels never carry meaning alone; every pastel fill has a deeper stroke or text step. Layouts are reviewed under a simulated washout |
| Dashboard patterns | Bach et al., *Dashboard Design Patterns* (2022) | Each KPI tile pairs one value (data information) with a line of context (meta information) |

## 3. Colour grammar

Four rules. Each colour means one thing, everywhere.

| Colour | Means | Where you see it | Never used for |
|---|---|---|---|
| **Burgundy** | Identity, and **the human in charge** | Primary buttons; every Approve button; the progress step that waits for you (*Your decision*, *Your approval*); the recommended option's frame; the recommendation the agent hands to you and your decisions in the console and the audit; the focus ring; the logo; GlobalCorp's own company codes on the rebate board | The state of a rebate position |
| **Red, amber, green** | **Rebate positions and outcomes**: money being lost (affected), at risk, resolved or recovered | The board's accounts, register links and race bars, KPI tints, status chips, the cost bars, *Confirmed* and *Not confirmed* in the console | Decoration, and buttons other than the two destructive ones |
| **Blue** | Checking, and money an option spends | *Check* steps in the console, the pulse on an account the agent is checking and the badges of what a lookup confirmed, links to sources, the response-cost bar | |
| **Violet** | **The AI's voice** | AI labels, *Hypothesis* and *Revised* lines, what-if alerts, the race's *First estimate* chip and a what-if account's striped segment, the reasoning summaries, the streaming cursor, model calls in the audit, the AI disclosure icon | Anything a person decided |
| **Ink** | Everything else: the agent's work | Text, tool calls, separators, neutral controls, Reject, guardrail notes | |
| **Hazard yellow and black** | **Simulation** | The SIMULATION badge, tape and watermark. Deliberately outside the palette, so a replay can never pass for a live run | |

On stage, in one sentence: *"Burgundy is you, violet is the AI, red, amber and green are the money."*

Every status colour comes with a second cue (WCAG 1.4.1): a word (*Affected*, *Approved*), an icon, a larger marker or a heavier line. The danger red appears on two buttons only, **Abort** and **Forget key**, because they stop or delete something.

**The rebate board in this grammar.** The board has two views, and both speak the same colours.
- *Group view.* The supplier group is a hub in a white ring. The accounts linked to the agreement sit on the ring: the year-end report counts them. The register members that are not linked sit outside it, with dashed outlines: the report misses them. Dots are one quiet slate, sized by the closed year's spend; register links run from each account to the hub, dashed for an acquired company. A look-alike the duplicate check found stands apart, joined to the account it resembles by a dotted line with a red ✕: *no merge*. GlobalCorp's company codes the group bills are burgundy chips with their city, because they are the client's own. When the agent's verified alert names the gap, the missed accounts and their links turn red, and only they: an account the report counts stays slate whatever the run said about it before, and a linked account the report still leaves out says why on its label (*Linked, but the report counts EUR only*; *Linked, but the report lists Apex only from €5M*). After a decision the board follows the money: the accounts the approved option links glide onto the ring and turn green, a year the option claims in full turns green, a year it claims in part or not at all turns amber with what is still lost (and so do the gap accounts behind it, while the accounts the report already counts keep their colour), and an accepted loss stays red and says so. Green means *approved or settled*: nothing on the board says "recovered" before a supplier has paid.
- *The band.* When the board is too short for the ring and its labels (the open drawer, a small screen), or the labels cannot be placed without covering each other, the group becomes a band under the race: the hub, then the ring as a rounded band holding the linked accounts, then the others outside it, each with its spend in the year the race leads with (named at the band's end). The dots keep their shape under the state colours (solid when linked, dashed when not), so the picture survives at the moment of the decision, and the accounts an option links slide into the band. Short of width, the band keeps the words that tell the accounts apart (*Meraki*, *Cisco Systems*), then drops the amounts, then keeps the dots alone, each still a button with its full name.
- *Threshold race.* Above the group, one bar per agreement year runs against the rebate tiers (black ticks, ✓ once passed) and, where the report has one, its minimum (amber dashes). The rows are named for what they are: the *closed year* (the last agreement year that ended, whose claim is due now), the *current year* (projected, hatched) and, while a look-back clause keeps it claimable, the *look-back year*; every row is an agreement year, so none is called that. Slate is what the year-end report counted, red what it missed, violet stripes an account counted only as a what-if; a bracket under the bar says how much the report missed. A year whose missed accounts change nothing (no rebate either way) draws them pale, so the strong red stays with money that is open. The key sits in the card's head and shows only the marks on the bars. The chip names the basis in the grammar: *Year-end report* in ink, *First estimate* and *What-if* in violet, *Verified count* in blue, *Partial count* in amber. Approval is a decision, not a payment: a year the approved option covers reads *option A approved*, the way in (credit note, set-off, the year-end claim) and when the cash comes in, never *recovered*.
- *Portfolio view.* Every agreement in one card, next claim deadline first, each with the race of the year that deadline is for (Microsoft's look-back year, not its closed year with nothing owed) and that year named under the deadline; a deadline within 30 days (the KPI tile's threshold for an urgent deadline) is set in amber, and a row the agent marked carries the state on its left edge and in its accessible name.

**Why a board and not a map.** For a supply-chain disruption, place is the question: which sites, which routes. For a missed rebate it is not: what decides the money is who belongs to the supplier group (the register), whether the agreement counts them (the links), and how far the group's spend is from the next tier (the thresholds). The board puts exactly those three on screen, so the finding reads from across the room: *these accounts are outside the ring, this bar would cross the tier with them, this is the claim and its deadline.*

## 4. How the palette is made

`tools/palette.mjs` generates every colour from one input, `SOURCE = "#7a1e3a"`, which is `oklch(0.394 0.127 7.1)`. It is the Navigator's generator with the same source; the 96 token values are identical in both apps.

1. **Ladder.** Steps 1–8 share one lightness ladder across all families (L 0.993 → 0.772), so a tint of red and a tint of blue at the same step weigh the same. Steps 9–12 are set per family, so that solids and text meet their contrast duties.
2. **Tints.** Chroma grows with the step. Burgundy tints use 75 % of the usual chroma, so the pale steps read as rosewood, not candy pink.
3. **Ink.** The neutrals carry the burgundy hue at very low chroma (0.004–0.02), so every grey on the page belongs to the brand. Shadows are tinted with the darkest burgundy, never black.
4. **Harmonisation.** Where colour is atmosphere, hues turn towards burgundy by Material's rule (half the hue distance, at most 15°; applied to OKLCH hue rather than Material's HCT): the vendor-master slate and the blue move from 250° to 265°, violet from 295° to 310°.
5. **Fixed state hues.** Where colour is meaning, hues are fixed: danger 29°, warning 57°, success 170°. Red is deeper than amber and the green leans blue (the "bluish green" of Okabe and Ito), so the three differ in lightness and on the blue–yellow axis, which red–green colour blindness preserves. Red also stays clear of burgundy: at least 18° of hue and 0.12 of lightness apart.
6. **Gamut.** Colours outside sRGB are brought in by lowering chroma only; lightness and hue stay.

| Family | Hue | Role |
|---|---|---|
| `wine` | 7.1° (source) | Brand, actions, the human's decisions, GlobalCorp's own company codes |
| `ink` | 7.1°, chroma ≤ 0.02 | Text, surfaces, borders |
| `slate` | 265° (harmonised) | The vendor master at rest: accounts, register links, the supplier group, what the report counted |
| `danger` | 29° (fixed) | Money being lost; destructive actions |
| `warning` | 57° (fixed) | At risk; not confirmed |
| `success` | 170° (fixed) | Resolved or recovered; approved; confirmed |
| `info` | 265° (harmonised) | Checking; money an option spends |
| `violet` | 310° (harmonised) | The AI's voice |

**Outputs.** `css/tokens.css` holds the primitives (`--wine-1` … `--violet-12`) as hex, each with its OKLCH value in a comment. `design/tokens.json` holds the same primitives in the W3C Design Tokens Format 2025.10 (`colorSpace: "oklch"`, `components`, `hex` fallback) plus the role aliases. Both files are generated: never edit them by hand.

**Roles.** `css/style.css` maps primitives to roles and contains no colour values of its own, apart from white and the simulation colours. Components use roles: `--brand`, `--brand-soft`, `--text-muted`, `--line`, `--border-control`, `--danger-line`, `--violet-text` and so on. The rebate board (`css/board.css`) uses the same roles: `--affected`, `--at-risk`, `--resolved` and their `-fill` variants, `--network`, `--sea` for its canvas, and the danger, warning, success, info and violet families.

**Type.** Barlow for the interface, Barlow Semi Condensed for figures and headings, IBM Plex Mono for tool names and ids; all self-hosted (`fonts/`, SIL Open Font License).

## 5. The checks

`node tools/palette.mjs --check` runs 45 checks and fails the build if any fails. It is the first suite in `node tests/run-all.mjs`.

**Contrast (WCAG 2.2), 32 pairings.** Body text 15.9:1 on paper (AAA, 1.4.6, needs 7). Muted and faint text 6.9:1 and 5.0:1 (1.4.3, needs 4.5). White on burgundy 10.1:1. Burgundy text 8.2:1. Input and toggle borders 4.0:1, and every state stroke and icon on paper: danger 5.7, warning 3.3, success 3.6, blue 4.4, violet 5.0, slate 5.5 (1.4.11, needs 3). Each family's text step is also checked on its own tint. The danger stroke on its board fill reaches 3.95:1.

**Brand vs danger, 2 checks.** Hue gap 21.9° (needs 18°), lightness gap 0.14 (needs 0.12).

**Colour-blind separation, 9 pairs.** Each pair is simulated for normal vision, protanopia, deuteranopia and tritanopia with the Machado et al. (2009) matrices at full severity, applied in linear RGB. The smallest OKLab distance must be at least 0.10, five times the 0.02 just-noticeable difference that CSS Color 4 uses for gamut mapping.

| Pair | Smallest ΔEOK | Worst case |
|---|---|---|
| Affected vs at risk | 0.120 | deuteranopia |
| Affected vs resolved | 0.111 | deuteranopia |
| At risk vs resolved | 0.104 | protanopia |
| Affected vs the vendor master (slate) | 0.156 | protanopia |
| At risk vs the vendor master | 0.188 | protanopia |
| Resolved vs the vendor master | 0.113 | deuteranopia |
| Cost bars: response cost vs rebate still lost | 0.237 | protanopia |
| Cost bars: response cost vs doing nothing | 0.228 | deuteranopia |
| Burgundy vs danger | 0.130 | protanopia |

**Token files, 2 checks.** `css/tokens.css` and `design/tokens.json` must match what the generator produces now.

Two pairings in use are not yet covered by the checker and fall slightly short, in both apps: faint text on the porcelain app background (4.44:1) and the amber "rebate still lost" bar on its track (2.78:1). `REVIEW.md` (W9) proposes the fix, to be applied to both prototypes together so their palettes stay identical.

## 6. Agentic patterns

Yocco's six patterns for agentic AI, and where each one lives:

| Pattern | In Rebate Hunter |
|---|---|
| Intent preview | The **progress rail** shows the agent's five-step plan before the run starts (Spot, Check, Calculate, Propose, Prepare), and the intro window explains it |
| Autonomy dial | Fixed at one level on purpose: *plan and propose, you approve*. Every outbound action (claim letter, set-off posting, master-data request) is a draft that needs its own approval |
| Explainable rationale | The recommendation line, *Confirmed:* and *Revised: old → new* with their evidence, the reasoning summaries, the AI label's explanation, and **Guardrail** notes when the code refuses a step |
| Confidence signal | Alerts are *verified* (two distinct sources and two kinds of evidence from the run, and for accounts outside the agreement the register plus an independent confirmation, enforced in code) or labelled *what-if*; *Not confirmed* lines in amber |
| Action audit and undo | The Audit tab and its JSON export. Undo is not needed: nothing leaves the outbox |
| Escalation pathway | The agent hands over at each decision (the rail turns burgundy), continues as a labelled what-if when it cannot confirm, and ends as **Stopped** rather than guess |

**Progress rail** (`js/progress.js`). Five steps, the same as the intro. Ink while the agent works, with a pulse on the current step. Burgundy with *Your decision* or *Your approval* when the run waits for a person. A tick when done, a stop mark where a run ended early, a dashed circle for steps a run did not need. It never moves backwards when the agent revisits an earlier phase. It is an ordered list, the current step carries `aria-current="step"`, and each step's state is spelled out for screen readers. A container query hides the labels of other steps when the console is narrow.

**Handover** (`js/handover.js`). The run state *awaiting approval* covers two moments, so the status pill, the console's phase line and the rail all name the human step the same way: **Awaiting your decision** while the options wait, then **Awaiting your approval** while the drafts wait.

**AI labels** (`js/ai_label.js`). After Carbon for AI: a small violet **AI** mark at the upper right of the options summary, each draft and the management summary. Clicking it opens a toggletip that stays open until you click elsewhere or press Escape. It says who wrote the content (the live model by name, a recorded run, or the scripted replay), that the euro figures and claim deadlines come from the deterministic rebate engine and that the amounts in drafts and summaries were checked against tool results, and what approval does. A draft whose amounts could not be matched after two refusals carries an amber **Unchecked amounts** chip next to its status. The label is 24 px, inside a 40 × 40 px target.

**Guardrail notes** (`js/console.js`). When code refuses an agent step (an alert with one source, an amount no tool returned, a draft the approved option does not contain, a summary outcome that contradicts the decision), the console shows a quiet ink line, *Guardrail: The draft was refused.* with the reason, and the run facts count the refusals. The audience sees the guardrail work instead of a silent retry. The rules live in one module, `js/guards.js`, which the simulation checker applies too, so a replay never shows a step a live run would be refused.

**Evidence on the alert.** Below the sources the agent cites, a verified alert card lists what the run actually checked, from the tool results: *Checked in this run: register: Cisco family tree; GLEIF: … consolidated by …; web search (2 results)*. The agent's words and the record of the checks stay apart.

**Discarded responses.** When a response breaks off and is retried, or is cut off and redone, what it had shown stays in the console for the record, dimmed and marked *Discarded*, and counts for nothing.

## 7. Built for the room

- **Projection.** Muted colours blend on a projector (VUMC). Pastels therefore only ever fill; the meaning sits in a deeper stroke or text step at 3:1 or more. The options view is reviewed under a simulated washout (`contrast(0.62) brightness(1.18) saturate(0.8)`).
- **Emphasis.** Google's research on Material 3 Expressive (46 studies, more than 18,000 participants) found that people spotted key elements up to four times faster when colour, size, shape and containment pointed at them, and that breaking familiar patterns hurt. Rebate Hunter spends emphasis on one thing per moment: the recommended option has the burgundy frame and the only solid Approve; the other options have outline buttons; the rail highlights one step.
- **Size.** The root font scales to about 17 px at 1920 px wide; **Larger text** enlarges the console. On the board, account names are about 19 px, tier labels and the bracket's words about 17 px and 15 px, and the ring grows to a radius of 190 px on a large panel. Every HTML control is at least 40 × 40 px, well above the 24 px minimum of WCAG 2.5.8 (`tests/layout.mjs`). On the rebate board every entity is a button of at least 44 px: every account (a target around a smaller dot), the group (its hub grows and shrinks with the ring, never below 44 px), each company code, each race row, each portfolio row and each account of the band. All are reachable by keyboard, and their details open in a popover that Escape closes, giving the focus back (the Navigator's map markers are smaller and mouse-only, `REVIEW.md` W11).
- **Nothing covers the finding.** The legend never covers the race or the accounts: it opens with its toggles first and one line per entry, opens by itself only where the whole card fits beside the group, and folds otherwise. When the presenter opens it, the group makes room: the ring shrinks and its labels go slimmer, or, where even that leaves no ring of 48 px, the band takes its place. The folded legend, the company codes, the group's caption and the look-alike's struck link are obstacles the labels keep clear of. The layout places the ring, the accounts and their labels by how far each reaches, and picks the largest ring and the widest labels that fit; labels move up or down until none overlaps another, and drop their check badges, then their spend line, then their reason, when a side has no room for them all. If they still cannot all be placed, the band stands in. When the drawer leaves the board too short for the ring, the race keeps the rows that fit whole, the years with money open first (*+1 year not shown* in its head, or in the caption on a short board), and a short board keeps one line under each figure. On a panel that is merely low, years with no rebate either way (never the closed year) give their room to the group first. A year's details open under the race card with a tip, so they cover no bar; on a board too short for that they open beside the year's figures. The ring's own label steps aside when an account sits under it. `tests/layout.mjs` checks all of it in five viewports and six states, including the finding during the run and the legend opened by the presenter, and the other five scenarios at 1280 × 720 and 1600 × 900.
- **Focus.** A 2 px burgundy ring outside a 2 px white gap: 10:1 against paper, meeting WCAG 2.4.13 Focus Appearance. Controls with a shadow of their own (the board's view buttons, the hub, the company codes) keep the ring next to it, and a portfolio row draws it inside its edge, where the scrolling card cannot cut it. After a decision the options and the outbox rebuild their cards; focus moves to the next decision (the next Approve) instead of falling back to the page. The board keeps its buttons across redraws, so a run's events never take the focus away; a popover finds its button again after a redraw; and a portfolio row opened by keyboard moves the focus to the group it opens.
- **Motion.** One pulse on the active rail step, the streaming cursor, and on the board: a blue pulse on an account being checked, a short flash on a newly affected account, race segments that grow, a tier's label that pulses once when the bar passes it, the figure counting up, the accounts an approved option links sliding into the band, and gliding onto the ring when the drawer is hidden. Only a change of place glides; a new size simply re-places, and switching to another agreement draws its race afresh. All of it stops under `prefers-reduced-motion`, and the board then shows its final state at once (`tests/smoke.mjs`, case *motion*).
- **Words.** Labels name what a person understands: *Your decision*, *Approve*, *Accept the loss*, *Forget key*. The same action keeps the same name through the flow. KPI tiles say what and when in a few words, as the Navigator's do: *Rebate at risk €2.14M, 400-day exposure, verified*; *Claim deadline in 31 days, Cisco, Sun 15 Nov* (the dates move with the day the app is opened); after a decision *left with option A (was €2.14M)*. Dates carry the year when it is not this year (*Sun 14 Nov 2027*). The header keeps two badge rows down to 1280 px in every scenario (`tests/layout.mjs`).

## 8. Testing the design

| Command | What it does |
|---|---|
| `node tools/palette.mjs --check` | The 45 colour checks above (Node.js only) |
| `node tests/layout.mjs` | Five viewports from 1920×1080 to 1280×720, idle, at the finding, with options, with drafts, approved with the drawer hidden and with the legend opened; no overflow; badges never overlap the KPI tiles; the header keeps its height; one-row control bar; on the rebate board nothing leaves the panel and nothing covers anything else, the group stays in view (ring or band) and no race row is cut; the other five scenarios at 1280×720 and their findings at 1600×900 with the same board rules; targets ≥ 40 px in seven states |
| `node tests/design.mjs` | In the running app: the board's accounts (ring or band), register links, race segments, the race's key and the legend use the state tokens, before and after the decision; pill, console and rail name the human step; AI labels open and close. Writes review screenshots: the options normally and under the washout, and the finished run as seen with protanopia, deuteranopia and tritanopia |

The browser suites need Playwright (`tests/README.md`). The colour-blind screenshots use the same matrices as the palette check, applied by an SVG colour-matrix filter in linear RGB.

## 9. Changing things safely

**Keep the sister apps in step.** The palette, `css/` (except `board.css`) and the shell modules listed in `REVIEW.md` Part 4 (*Shared shell*) are meant to stay identical to the Navigator's. Change them in both repositories in the same way, or the two prototypes drift apart.

**Change the brand colour.** Edit `SOURCE` in `tools/palette.mjs` and run `node tools/palette.mjs`. Both token files are rewritten and the checks run. If one fails, adjust that family's solid or text lightness in `FAMILIES` and run it again. Then update `favicon.svg`, the only file that cannot read the tokens. The logo in the page is drawn from the tokens.

**Add a colour.** Add a family to `FAMILIES`, give it contrast duties in `PAIRS`, and add separation pairs to `SEPARATE` if it carries meaning next to other colours. Map it to a role in `css/style.css` and use the role, not the primitive.

**Keep the grammar.**
- Burgundy only for identity, GlobalCorp's own company codes, and what a person does or decides.
- Status colours only for rebate positions and outcomes, and always with a word, an icon or a shape.
- Violet only for what the AI wrote or thinks. New AI-written content gets an AI label.
- No new hex values in components: use a role.
- New interactive elements are at least 40 × 40 px (44 px on the board) and use the shared focus ring; an element with its own shadow lists `var(--focus)` with it under `:focus-visible`.

## Sources

- CSS Color Module Level 4, gamut mapping (JND 0.02): https://drafts.csswg.org/css-color-4/
- Evil Martians, *OKLCH in CSS: why we moved from RGB and HSL*: https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl
- Radix Colors, *Understanding the scale*: https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale
- Material Color Utilities, `Blend.harmonize`: https://api.flutter.dev/flutter/package-material_color_utilities_blend_blend/Blend/harmonize.html
- Okabe & Ito, *Color Universal Design*: https://jfly.uni-koeln.de/color/
- Machado, Oliveira & Fernandes (2009), *A physiologically-based model for simulation of color vision deficiency*, IEEE TVCG 15(6): https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html
- R colorspace, `simulate_cvd` (the matrices apply to linear RGB): https://www.rdocumentation.org/packages/colorspace/versions/2.1-2/topics/simulate_cvd
- W3C Design Tokens Format Module 2025.10: https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Victor Yocco, *Designing For Agentic AI: Practical UX Patterns For Control, Consent, And Accountability*, Smashing Magazine, 11 Feb 2026: https://www.smashingmagazine.com/2026/02/designing-agentic-ai-practical-ux-patterns/
- IBM Carbon for AI, AI label usage: https://carbondesignsystem.com/components/ai-label/usage/
- Heydon Pickering, *Tooltips & Toggletips*, Inclusive Components: https://inclusive-components.design/tooltips-toggletips/
- Google Design, *Expressive Design: Google's UX Research*: https://design.google/library/expressive-material-design-google-research
- VUMC Edge for Scholars, *Optimizing Colors for Projected Presentations*: https://edgeforscholars.vumc.org/optimizing-colors-for-projected-presentations
- Bach et al., *Dashboard Design Patterns*, IEEE VIS 2022: https://arxiv.org/abs/2205.00757
