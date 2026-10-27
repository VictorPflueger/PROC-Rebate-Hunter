# Rebate Hunter — design system

How Rebate Hunter looks, why it looks that way, and how to change it without breaking it. Version 7.2.0, 27 October 2026.

Rebate Hunter is built on **Vici**, Victor Pflüger's design system (release v1.0.0, copied unchanged into `vici/`; `vici/README.md` says which files and from where). Vici decides the look: its tokens in a light and a dark theme, its fonts, components, icons and hexagon shapes. This prototype's rules decide the meaning: what a colour stands for, what needs emphasis, what the room must see. Where the two meet, this file says how, and §10 lists every deliberate deviation from Vici with its reason.

Rebate Hunter shares its shell with its sister prototypes, the **Navigator** (supply-chain disruptions), the **Timetable Translator** and **Repack Pilot**: the same Vici copy, the same shell code and styles, the same colour grammar and agentic patterns. Where the Navigator shows a map, Rebate Hunter shows a **rebate board**, built from the same canvas, floating controls, legend card, popovers and grammar (§3). `REVIEW.md` Part 4 lists the shared shell item by item.

---

## 1. The brief

- **On Vici.** The prototype looks like the rest of Victor's work: merlot ink and pastel surfaces, Bricolage Grotesque, Inter and JetBrains Mono, hexagons where other systems draw circles. Its page icon is the card it has on Victor's website (§4).
- **Legible in 60 seconds.** A partner who has never seen the tool should get the point from across a room, on a 1080p projector, often in a lit room: *these accounts belong to one supplier group, the rebate was never claimed, this is what it is worth and when the claim expires.*
- **Agentic.** An AI agent acts on screen. At every moment the viewer must be able to tell who is acting: the agent, or the person who has to decide.

Everything below follows from those three lines.

## 2. Methods, and what each one decided

| Method | Source | What it decided |
|---|---|---|
| A design system with semantic tokens | Vici v1.0.0 (`vici/`) | Every colour is one of Vici's semantic tokens (`--vc-text`, `--vc-accent`, `--vc-danger-solid` …), which switch with the theme; no colour values of the app's own (§4) |
| The hexagon rule | Vici, *Hexagon* guideline: "If it would be round, make it a hexagon" | Dots, pips, badges, rings, hubs, markers, spinners, pulses and pills are flat-top hexagons and hex capsules (§4); `tests/hexagon.mjs` keeps it so |
| Colour-blind separation | Machado, Oliveira & Fernandes (2009) | The state colours are measured under simulated colour blindness (`tests/tokens.mjs`); where Vici's tones come close, form carries the difference (§3, §5) |
| Accessibility | WCAG 2.2 | Contrast for every pairing in both themes, the focus ring, target size, no meaning by colour alone |
| Agentic UX patterns | Yocco, *Designing For Agentic AI*, Smashing Magazine, Feb 2026 | The progress rail (intent preview), the handover to the human, the audit trail |
| AI labelling | IBM Carbon for AI; Pickering, *Tooltips & Toggletips* | An **AI** label (Vici's feature tag, the sparkle and "AI") on the options, drafts and summary the agent wrote, with a short explanation one click away |
| Emphasis | Google, *Expressive Design: Google's UX Research* (Material 3 Expressive) | One emphasised action per moment: colour, size and containment go to the step that needs the person |
| Projection | VUMC Edge for Scholars, *Optimizing Colors for Projected Presentations* | Pastels never carry meaning alone; every pastel fill has a deeper stroke or text step. Layouts are reviewed under a simulated washout |
| Dashboard patterns | Bach et al., *Dashboard Design Patterns* (2022) | Each KPI tile pairs one value (data information) with a line of context (meta information) |

## 3. Colour grammar

Four rules. Each colour means one thing, everywhere.

| Colour (Vici's tokens) | Means | Where you see it | Never used for |
|---|---|---|---|
| **Merlot** (`--vc-accent` and its tokens) | **The human in charge** | Primary buttons; every Approve; the progress step that waits for you (*Your decision*, *Your approval*); the recommended option's frame (2 px of `--vc-accent` on `--vc-accent-soft`); the recommendation the agent hands to you and your decisions in the console and the audit; the focus ring; the LIVE badge | A mark among state colours: merlot sits close to Vici's danger tone (§5) |
| **Danger, warning, success** (`--vc-danger-*`, `--vc-warning-*`, `--vc-success-*`) | **Rebate positions and outcomes**: money being lost (affected), at risk, resolved | The board's accounts, register links and race bars, KPI tiles, status tags, the comparison bars, *Confirmed* and *Not confirmed* in the console | Decoration, and buttons other than the two destructive ones |
| **Fjord** (`--vc-info-*`) | Checking, and money an option spends | *Check* steps in the console, the pulse around an account the agent is checking and the tags of what a lookup confirmed, the response-cost bar | |
| **Lilac** (`--vc-feature-*`) | **The AI's voice** | AI tags (`vc-tag--feature` with the sparkle and "AI"), *Hypothesis* and *Revised* lines, what-if alerts (`vc-alert--feature`), the race's *First estimate* tag and a what-if account's striped segment, the reasoning summaries, the streaming cursor, model calls in the audit, the AI disclosure | Anything a person decided |
| **Ink** (`--vc-text`, Vici's neutrals) | Everything else: the agent's work; the network at rest (`--vc-neutral-solid`); GlobalCorp's own sites | Text, tool calls, separators, neutral controls, Reject, guardrail notes; the board's accounts and links at rest; the company codes (their building, their code, a `--vc-border-strong` outline) | |
| **The tape** (`--vc-text` and `--vc-surface` stripes) | **Simulation** | The SIMULATION badge, the tape and the watermark, always with the word SIMULATION. Outside every state colour (Vici's honey now means *at risk*), so a replay can never pass for a live run | |

On stage, in one sentence: *"Merlot is you, lilac is the AI, red, honey and green are the money."*

**Every state has a form of its own** (WCAG 1.4.1), because Vici's state tones are close in lightness and some come close under colour blindness (§5): a word (*Rebate missed*, *To be linked (option A)*); Vici's state icons (error, warning, success) beside an account's reason and a company code's name; the mark inside each account's hexagon (a cross where the rebate is missed, a bar and dot where it is at risk, a tick where it is approved or settled); the account's outline (solid when linked, dashed when not, dotted for a look-alike); the bracket and its words under the missed part of a race bar. The danger tone appears on two buttons only, **Abort** and **Forget key**, as an outline, because they stop or delete something.

**The rebate board in this grammar.** The board has two views, and both speak the same colours.
- *Group view.* The supplier group is a hexagon cell (the hub, with Vici's honeycomb icon) inside a hexagonal ring. The accounts linked to the agreement sit on the ring's edges: the year-end report counts them. The register members that are not linked sit outside it, with dashed outlines: the report misses them. Accounts are hexagon cells in the network's neutral ink, sized by the closed year's spend; register links run from each account to the hub, dashed for an acquired company. A look-alike the duplicate check found stands apart, dotted, joined to the account it resembles by a dashed line with a ✕ in a hexagon: *no merge*. GlobalCorp's company codes the group bills are ink buttons with their building and city, because they are the client's own; when they have a state, it shows beside them as its icon and a ring in its tone. When the agent's verified alert names the gap, the missed accounts and their links turn to danger, and only they: an account the report counts stays neutral whatever the run said about it before, and a linked account the report still leaves out says why on its label (*Linked, but the report counts EUR only*; *Linked, but the report lists Apex only from €5M*). After a decision the board follows the money: the accounts the approved option links glide onto the ring and turn green with a tick, a year the option claims in full turns green, a year it claims in part or not at all turns honey with what is still lost (and so do the gap accounts behind it, while the accounts the report already counts keep theirs), and an accepted loss stays red and says so. Green means *approved or settled*: nothing on the board says "recovered" before a supplier has paid.
- *The band.* When the board is too short for the ring and its labels (the open drawer, a small screen), or the labels cannot be placed without covering each other, the group becomes a band under the race: the hub's cell, then the ring as a hex capsule holding the linked accounts, then the others outside it, each with its spend in the year the race leads with (named at the band's end). The cells keep their outline under the state colours (solid when linked, dashed when not) and their marks, so the picture survives at the moment of the decision, and the accounts an option links slide into the band. Short of width, the band keeps the words that tell the accounts apart (*Meraki*, *Cisco Systems*), then drops the amounts, then keeps the cells alone, each still a button with its full name.
- *Threshold race.* Above the group, one bar per agreement year runs against the rebate tiers (ink ticks, ✓ once passed) and, where the report has one, its minimum (honey dashes). The bars have square ends. The rows are named for what they are: the *closed year* (the last agreement year that ended, whose claim is due now), the *current year* (projected, hatched) and, while a look-back clause keeps it claimable, the *look-back year*. Neutral ink is what the year-end report counted, danger what it missed, lilac stripes an account counted only as a what-if; a bracket under the bar says how much the report missed. A year whose missed accounts change nothing (no rebate either way) draws them pale, so the strong red stays with money that is open. The key sits in the card's head and shows only the marks on the bars. The tag names the basis in the grammar: *Year-end report* plain, *First estimate* and *What-if* in lilac, *Verified count* in fjord, *Partial count* in honey. Approval is a decision, not a payment: a year the approved option covers reads *option A approved*, the way in (credit note, set-off, the year-end claim) and when the cash comes in, never *recovered*.
- *Portfolio view.* Every agreement in one card, next claim deadline first, each with the race of the year that deadline is for (Microsoft's look-back year, not its closed year with nothing owed) and that year named under the deadline; a deadline within 30 days (the KPI tile's threshold for an urgent deadline) is set in honey, and a row the agent marked carries the state on its left edge and in its accessible name. The agreement in focus has a 2 px ink frame (`aria-current`), never merlot.

A selection on the board is always ink: the focused agreement's frame, the legend's ticked toggles, the pressed view button.

**Why a board and not a map.** For a supply-chain disruption, place is the question: which sites, which routes. For a missed rebate it is not: what decides the money is who belongs to the supplier group (the register), whether the agreement counts them (the links), and how far the group's spend is from the next tier (the thresholds). The board puts exactly those three on screen, so the finding reads from across the room: *these accounts are outside the ring, this bar would cross the tier with them, this is the claim and its deadline.*

## 4. Where the look comes from

**Colours.** Every colour is one of Vici's semantic tokens, which switch with the theme. The app has no colour values of its own; the favicon is the one exception, because a favicon cannot read CSS. Vici's family primitives (`--vc-lilac-100` and so on) appear only where Vici uses them itself (the page icon's lilac cell). JavaScript draws no colour: the board's SVG takes its colours from classes in `css/board.css`, so a theme change repaints it, and the board still redraws on Vici's `vc:themechange` event. The roles of the former palette map onto Vici like this:

| Former role | Vici's token |
|---|---|
| `--paper` | `--vc-surface` |
| `--porcelain`, `--porcelain-2` | `--vc-bg`; `--vc-bg-subtle` for tracks, `--vc-surface-hover` for hover |
| `--line`, `--line-strong`, `--border-control` | `--vc-border-subtle`, `--vc-border`, `--vc-border-strong` |
| `--text`, `--text-muted`, `--text-faint` | `--vc-text`, `--vc-text-muted`, `--vc-text-subtle` |
| `--on-brand`, `--brand`, `--brand-deep` | `--vc-on-accent`; `--vc-accent`, `--vc-accent-hover`, `--vc-accent-pressed` |
| `--brand-text`, `--brand-mid`, `--brand-line` | `--vc-accent-text` (merlot text and icons, never among state colours); `--vc-accent-soft-hover` for quiet lines |
| `--brand-soft`, `--brand-wash` | `--vc-accent-soft` (`--vc-surface-selected` for a selected item in a list or menu), `--vc-surface-hover` |
| danger, warning, success, info (fill, mid, line, text) | `--vc-danger-bg`, `-border`, `-solid`, `-text` and the same for success and info; warning uses `--vc-warning-text` for lines too (its solid is a light fill, too pale for a stroke) |
| violet | lilac, Vici's feature tone: `--vc-feature-bg`, `-border`, `-solid`, `-text` |
| `--affected`, `--at-risk`, `--resolved` | the line and mid tokens of danger, warning and success |
| `--network` | `--vc-neutral-solid` |
| `--live` | `--vc-accent` |
| the hazard yellow and black of the simulation | the neutral tape: `--vc-text` and `--vc-surface`, with `--vc-bg-subtle` as its wash |
| `--sea` (the board's canvas) | `--vc-bg-sunken`, with Vici's honeycomb pattern |
| `--r-sm`, `--r-md`, `--r-lg` | `--vc-radius-md`, `--vc-radius-lg`, `--vc-radius-xl` |
| `--shadow-pop`, `--shadow-soft` | `--vc-shadow-lg`, `--vc-shadow-md` |
| `--focus` | Vici's focus ring, `var(--vc-stroke-focus) solid var(--vc-focus)`, hexagonal on hexagon controls |

The app keeps a handful of tokens of its own in `css/style.css`: the type sizes Vici has no step for (`--fs-xs`, `--fs-lg`, `--fs-xl`, `--fs-kpi`; `--fs-sm` and `--fs-md` became Vici's `--vc-font-size-sm` and `--vc-font-size-md`), because the layout and the projector checks are tuned to them, and `--hit`, 44 px, the smallest target for what the room clicks.

**Themes.** Light is the default: the prototypes are mostly shown on projectors in lit rooms. `js/theme.js` sets `data-theme="dark"` only if the visitor chose dark with the header's toggle (Vici's toggle, moon and sun, tooltip *Dark theme*), `data-theme="light"` otherwise; Vici remembers the choice under `vc-theme`, the key all of Victor's pages share. Every contrast check runs in both themes (§5).

**Type.** Bricolage Grotesque (`--vc-font-display`) only for short display text: the app's name, the KPI figures, dialog and panel titles, the board's caption and group name. Inter (`--vc-font-text`) for all other text, with tabular figures wherever numbers line up. JetBrains Mono (`--vc-font-mono`) for ids, timestamps, codes, tool names and raw output. Sentence case for headings, buttons, tabs and labels, except names, codes and the mode markings (§10). Reading text runs at most 75 characters per line: console entries, dialog texts, the summary and the drafts take Vici's prose measure (`--vc-container-prose`, 50ch, about 65 characters of Inter), while tool calls and their raw results keep the console's width. The root size follows the projector, in relative units so it still follows the reader's browser setting: `clamp(93.75%, 0.48vw + 50%, 112.5%)`, 15 px at 1280 px wide and about 17 px at 1920 px.

**Shapes.** Anything round is a flat-top hexagon, anything pill-shaped a hex capsule with pointed ends (Vici's `--vc-hex`, `vc-hex`, `vc-capsule`, `vc-cell`): status and live pips, count badges, the status, mode and AI-disclosure tags, the byline's portrait, spinners and pulses, the intro's numbered steps, the rail's markers, the option letters, the menu's scenario numbers; on the board the ring, the hub, every account, the band's *Linked* group, the legend's swatches and toggles, the checking pulse, the look-alike's ✕, and the canvas's honeycomb (Vici's pattern instead of a dot grid). The board's cells are drawn in SVG (`hexCell` in `js/board_group.js`), so their outlines can be dashed or dotted. Bars have square ends. Rectangles keep small radii, up to `--vc-radius-xl`. Other brands' logos stay as their owners publish them (LinkedIn's in the byline). In forced colours (Windows contrast themes) the app's own hexagons keep a visible outline, as Vici's cells do.

**Icons.** Vici's icons (`<span class="vc-icon vc-icon--NAME">`), through `js/icons.js`, which maps the app's names to Vici's (`reset` → `refresh`, `gear` → `settings`, `hub` and `target` → `honeycomb` …). Ten things have no Vici icon yet; the app draws them in Vici's style in the same module (24 × 24 with 2 px to spare, 1.75 px strokes with round caps and joins, hexagons where a shape would be round, chamfered corners) and proposes them for Vici (§11). They are written the way Vici writes its own icons, as masks (black strokes on the grid, which only say where the icon is), so they too take the colour of the text around them. Icon-only buttons have Vici's tooltip with their name.

**The page icon.** The prototype's mark is the card it has on Victor's website (`data/prototypes.js` of VictorPflueger/VIP: icon `search`, kind *prototype*): Vici's search icon in a lilac hexagon cell, in the header (`vc-cell vc-cell--lilac`), on the loading screen (`vc-cell--xl`) and, drawn larger and bolder so it reads at 16 px, as `favicon.svg`. If the website's card changes, the page icon changes with it, and the other way round (`tests/page-icon.mjs`).

**The byline.** The drawer bar carries Vici's byline: *Built by*, Victor's hexagon portrait and name, LinkedIn's own logo and a globe for his website, each a 44 px link that opens in a new tab. The app links to its author, never to its own source code.

## 5. The checks

`node tests/tokens.mjs` checks the colour system on Vici's values (`vici/dist/tokens.json`) in the light and the dark theme. It is the first suite in `node tests/run-all.mjs`.

**Contrast (WCAG 2.2).** Every text-on-fill and mark-on-surface pairing the app uses, the shared shell's and the board's (`tests/lib/prototype.mjs`), in both themes: 4.5:1 for text (1.4.3), 3:1 for marks, icons, control borders and the focus ring (1.4.11). The test fails below that. It also fails when the app's CSS or JavaScript names a Vici token that does not exist, or when a pairing names a token one theme lacks.

**Colour-blind separation.** The state colours, the network, checking, the comparison bars, the race's segments and merlot against danger, simulated for normal vision, protanopia, deuteranopia and tritanopia with the Machado et al. (2009) matrices at full severity in linear RGB. The former palette was generated to keep every pair at least 0.10 apart in OKLab; Vici's tones fall short of that in places, for example danger and success (0.030 in the light theme, 0.020 in the dark one), the race's counted and missed segments (0.043, 0.024), and merlot text and danger (a hue gap of 16.7° and a lightness gap of 0.03, where the former palette kept 18° and 0.12). The test reports these gaps rather than failing on them, because they are Vici's to fix: the app makes up for each in form (§3), and the colour-blind captures of `tests/design.mjs` show it.

## 6. Agentic patterns

Yocco's six patterns for agentic AI, and where each one lives:

| Pattern | In Rebate Hunter |
|---|---|
| Intent preview | The **progress rail** shows the agent's five-step plan before the run starts (Spot, Check, Calculate, Propose, Prepare), and the intro window explains it |
| Autonomy dial | Fixed at one level on purpose: *plan and propose, you approve*. Every outbound action (claim letter, set-off posting, master-data request) is a draft that needs its own approval |
| Explainable rationale | The recommendation line, *Confirmed:* and *Revised: old → new* with their evidence, the reasoning summaries, the AI label's explanation, and **Guardrail** notes when the code refuses a step |
| Confidence signal | Alerts are *verified* (two distinct sources and two kinds of evidence from the run, and for accounts outside the agreement the register plus an independent confirmation, enforced in code) or labelled *what-if*; *Not confirmed* lines in honey |
| Action audit and undo | The Audit tab and its JSON export. Undo is not needed: nothing leaves the outbox |
| Escalation pathway | The agent hands over at each decision (the rail turns merlot), continues as a labelled what-if when it cannot confirm, and ends as **Stopped** rather than guess |

**Progress rail** (`js/progress.js`, on Vici's stepper). Five steps, the same as the intro, in one line above the console. Ink while the agent works, with a pulsing hexagon on the current step. Merlot with *Your decision* or *Your approval* when the run waits for a person. A tick in ink when done, a stop mark where a run ended early, a dashed hexagon for steps a run did not need. It never moves backwards when the agent revisits an earlier phase. It is an ordered list, the current step carries `aria-current="step"`, and each step's state is spelled out for screen readers. A container query hides the labels of other steps when the console is narrow.

**Handover** (`js/handover.js`). The run state *awaiting approval* covers two moments, so the status tag, the console's phase line and the rail all name the human step the same way: **Awaiting your decision** while the options wait, then **Awaiting your approval** while the drafts wait.

**AI labels** (`js/ai_label.js`). After Carbon for AI: Vici's feature tag (lilac, the sparkle, **AI**) at the upper right of the options summary, each draft and the management summary. Clicking it opens a toggletip in Vici's popover look that stays open until you click elsewhere or press Escape. It says who wrote the content (the live model by name, a recorded run, or the scripted replay), that the euro figures and claim deadlines come from the deterministic rebate engine and that the amounts in drafts and summaries were checked against tool results, and what approval does. A draft whose amounts could not be matched after two refusals carries a honey **Unchecked amounts** tag next to its status. The label is 24 px, inside a 40 × 40 px target.

**Guardrail notes** (`js/console.js`). When code refuses an agent step (an alert with one source, an amount no tool returned, a draft the approved option does not contain, a summary outcome that contradicts the decision), the console shows a quiet ink line, *Guardrail: The draft was refused.* with the reason, and the run facts count the refusals. The audience sees the guardrail work instead of a silent retry. The rules live in one module, `js/guards.js`, which the simulation checker applies too, so a replay never shows a step a live run would be refused.

**Evidence on the alert.** Below the sources the agent cites, a verified alert card lists what the run actually checked, from the tool results: *Checked in this run: register: Cisco family tree; GLEIF: … consolidated by …; web search (2 results)*. The agent's words and the record of the checks stay apart.

**Discarded responses.** When a response breaks off and is retried, or is cut off and redone, what it had shown stays in the console for the record, dimmed and marked *Discarded*, and counts for nothing.

## 7. Built for the room

- **Projection.** Muted colours blend on a projector (VUMC). Pastels therefore only ever fill; the meaning sits in a deeper stroke or text step at 3:1 or more. The options view is reviewed under a simulated washout (`contrast(0.62) brightness(1.18) saturate(0.8)`).
- **Emphasis.** Google's research on Material 3 Expressive (46 studies, more than 18,000 participants) found that people spotted key elements up to four times faster when colour, size, shape and containment pointed at them, and that breaking familiar patterns hurt. Rebate Hunter spends emphasis on one thing per moment: the recommended option has the merlot frame, its tag on the frame and the only solid Approve; the other options have soft or outline buttons; the rail highlights one step.
- **Size.** The root font scales to about 17 px at 1920 px wide; **Larger text** enlarges the console. Vici's buttons, tabs, tags, menu items and fields keep the sizes the app had before Vici (§10). On the board, account names are about 19 px, tier labels and the bracket's words about 17 px and 15 px, and the ring grows to a radius of 190 px on a large panel. Every HTML control is at least 40 × 40 px, well above the 24 px minimum of WCAG 2.5.8 (`tests/layout.mjs`). On the rebate board every entity is a button of at least 44 px: every account (a hexagonal target around a smaller cell), the group (its hub grows and shrinks with the ring, never below 44 px), each company code, each race row, each portfolio row and each account of the band. All are reachable by keyboard, and their details open in a popover that Escape closes, giving the focus back.
- **Nothing covers the finding.** The legend never covers the race or the accounts: it opens with its toggles first and one line per entry, opens by itself only where the whole card fits beside the group, and folds otherwise. When the presenter opens it, the group makes room: the ring shrinks and its labels go slimmer, or, where even that leaves no ring of 48 px, the band takes its place. The folded legend, the company codes, the group's caption and the look-alike's struck link are obstacles the labels keep clear of. The layout places the ring, the accounts and their labels by how far each reaches (a hexagon is 1.15 times as wide as it is high), and picks the largest ring and the widest labels that fit; labels move up or down until none overlaps another, and drop their check tags, then their spend line, then their reason, when a side has no room for them all. If they still cannot all be placed, the band stands in. When the drawer leaves the board too short for the ring, the race keeps the rows that fit whole, the years with money open first (*+1 year not shown* in its head, or in the caption on a short board), and a short board keeps one line under each figure. On a panel that is merely low, years with no rebate either way (never the closed year) give their room to the group first. A year's details open under the race card with a tip, so they cover no bar; on a board too short for that they open beside the year's figures. The ring's own label, straight along its top edge, steps aside when an account sits under it. `tests/layout.mjs` checks all of it in five viewports and six states, including the finding during the run and the legend opened by the presenter, and the other five scenarios at 1280 × 720 and 1600 × 900.
- **Focus.** Vici's focus ring: 2 px of `--vc-focus` with a 2 px gap, an outline on rectangles and a hexagonal ring on hexagon controls (the hub, the accounts, the band's hub, the legend's toggles, icon buttons). Controls with a shadow of their own keep the ring next to it, and a portfolio row draws it inside its edge, where the scrolling card cannot cut it. After a decision the options and the outbox rebuild their cards; focus moves to the next decision (the next Approve) instead of falling back to the page. The board keeps its buttons across redraws, so a run's events never take the focus away; a popover finds its button again after a redraw; and a portfolio row opened by keyboard moves the focus to the group it opens.
- **Motion.** One pulsing hexagon on the active rail step, the streaming cursor, and on the board: a fjord ring that pulses around an account being checked, a short flash on a newly affected account, race segments that grow, a tier's label that pulses once when the bar passes it, the figure counting up, the accounts an approved option links sliding into the band, and gliding onto the ring when the drawer is hidden. Only a change of place glides; a new size simply re-places, and switching to another agreement draws its race afresh. All of it stops under `prefers-reduced-motion` (a checked account keeps a still ring), and the board then shows its final state at once (`tests/smoke.mjs`, case *motion*).
- **Words.** Labels name what a person understands: *Your decision*, *Approve*, *Accept the loss*, *Forget key*. The same action keeps the same name through the flow. KPI tiles say what and when in a few words: *Rebate at risk €2.14M, 400-day exposure, verified*; *Claim deadline in 31 days, Cisco, Fri 27 Nov* (the dates move with the day the app is opened); after a decision *left with option A (was €2.14M)*. Dates carry the year when it is not this year (*Sun 14 Nov 2027*). The header keeps two badge rows down to 1280 px in every scenario (`tests/layout.mjs`): Inter and Bricolage run wider than the former Barlow, so "How it works" sits beside the mode badge, the tiles' second lines wrap at most once, and from 1700 px down the figures step to 1.875rem. The AI disclosure keeps its full sentence, "You are interacting with an AI system", at 1280 px and wider.

## 8. Testing the design

| Command | What it does |
|---|---|
| `node tests/tokens.mjs` | Contrast for every pairing in both themes, every Vici token the app names exists, colour-blind separation reported (Node.js only) |
| `node tests/hexagon.mjs` | The hexagon rule, modelled on Vici's `scripts/check-hex.mjs`: the app's own files (not `vici/`, `vendor/`, `tests/` or `tools/`) must hold no round CSS (a radius of 25 %, 40 px or 2.5 rem or more, viewport units in a radius, `circle()` or `ellipse()` in a clip path, radial gradients) and no round drawing code (`<circle>`, `<ellipse>`, a pill-shaped `<rect>`, "circle" or "ellipse" handed to an element factory, Leaflet circles, canvas arcs, path data with arc commands); the rendered app, at the main states of a simulation run in both themes, must hold no element whose corners are at least half its size, no circle or ellipse, no arc. Planted examples of each kind come first, and the test fails if it misses one. An exception needs its reason, written in the test |
| `node tests/page-icon.mjs` | `favicon.svg` byte for byte; the header's and the loading screen's cells; and, when a checkout of Victor's website sits next to this repository, that its card still gives this prototype the same icon and kind |
| `node tests/vici-files.mjs` | `vici/` holds exactly the files `vici/README.md` lists, everything Vici's stylesheet loads is there, and (with a checkout of Vici at the same release next to this repository) every file is unchanged |
| `node tests/layout.mjs` | Five viewports from 1920×1080 to 1280×720, idle, at the finding, with options, with drafts, approved with the drawer hidden and with the legend opened; no overflow; badges never overlap the KPI tiles; the header keeps its height; one-row control bar; on the rebate board nothing leaves the panel and nothing covers anything else, the group stays in view (ring or band) and no race row is cut; the other five scenarios at 1280×720 and their findings at 1600×900 with the same board rules; targets ≥ 40 px in seven states |
| `node tests/design.mjs` | In the running app, in the light and the dark theme: the board's accounts (ring or band), register links, race segments, the race's key and the legend use the state tokens of the theme on screen, before and after the decision; tag, console and rail name the human step; AI labels open and close. Writes review screenshots in both themes: the options normally and under the washout, and the finished run as seen with protanopia, deuteranopia and tritanopia |
| `node tests/smoke.mjs once` | Every control does its job exactly once: the theme toggle and the tooltips (vici.js's), *Larger text*, the board's views and legend toggles, the replay speed, a drawer tab, a dialog's backdrop and Escape, *Show key* (the app's). A toggle that both sides flipped would look unchanged, which a plain click test misses |

The browser suites need Playwright (`tests/README.md`). The colour-blind screenshots use the same matrices as the colour test, applied by an SVG colour-matrix filter in linear RGB.

## 9. Changing things safely

**Keep the sister apps in step.** Rebate Hunter, the Navigator, the Timetable Translator and Repack Pilot share one shell (`REVIEW.md` Part 4, *Shared shell*): `vici/` (the same Vici release, unchanged), `css/` except `board.css` (each prototype's centrepiece has its own stylesheet), `js/theme.js` and the shell modules listed there, and four tests that are the same file in every prototype: `tests/tokens.mjs`, `tests/hexagon.mjs`, `tests/page-icon.mjs` and `tests/vici-files.mjs`. What differs between the prototypes in those tests (the colour pairs only one prototype draws, the tour the hexagon test takes, the page icon) lives in one place, `tests/lib/prototype.mjs`, and the shared tests use only what every prototype's `tests/lib/harness.mjs` exports. Change a shared file in all four repositories in the same way, or the prototypes drift apart; the Timetable Translator's CI compares its shell with this repository's `main`.

**Colours come from Vici.** There is no palette to regenerate any more. To use a colour, pick the semantic token whose meaning fits (§3, §4), never a family primitive or a value of your own, and add the pairing to the contrast test: to `SHELL_PAIRS` in `tests/tokens.mjs` for the shared shell, to `COLOUR_PAIRS` in `tests/lib/prototype.mjs` for the board. To change a colour, change Vici: a fix belongs in Vici's next release, which then comes here as described in `vici/README.md` (copy the files, change the version, run the tests, look at the prototype in light and dark). Never edit the copy in `vici/`. `favicon.svg` is the one file with colour values of its own: change it together with the website's card.

**Keep the grammar.**
- Merlot only for what a person does or decides, and never as a mark among state colours. GlobalCorp's own entities are ink, by form and words.
- State colours only for rebate positions and outcomes, and always with a word, an icon, a mark or a shape.
- Lilac only for what the AI wrote or thinks. New AI-written content gets an AI label.
- No colour values in components: use a token. Anything round is a hexagon; anything pill-shaped a hex capsule.
- New interactive elements are at least 40 × 40 px (44 px on the board) and use Vici's focus ring, hexagonal on a hexagon.

## 10. Deviations from Vici

Each one deliberate, with its reason:

| Where | Vici | Rebate Hunter | Why |
|---|---|---|---|
| Buttons, icon buttons, inputs, menu items, tabs | 2.5 rem controls with .875 rem text (37.5 px at a 15 px root); tabs .875 rem; menu items 2.25 rem | 44 px with 1 rem text; compact buttons 40 px with .875 rem; tabs and menu items 44 px with 1 rem | The room reads the screen from a distance, and nothing clickable is under 40 px (WCAG 2.5.8, projector use) |
| Tags and count badges | 1.5 rem with .75 rem text; badges 1.25 rem | Tags 26 px with .8125 rem (the status tag 44 px, the mode badge 36 px, the AI disclosure 36 px); badges 24 px | Today's sizes: the state words must read from the back of the room |
| Profile links in the byline | 24 px targets | 44 px | The board's and the bar's targets are 44 px |
| Field labels, help and alerts | `vc-label` .875 rem, `vc-help` .75 rem, alerts .875 rem | Labels 1 rem, help .875 rem, alerts 1 rem | The sizes the app had: they are read from the back of the room |
| Danger button | Solid danger fill | Abort and Forget key as an outline in the danger tone | A solid red bar in the control bar would shout at the room for an action that is rarely needed |
| Segmented control | `vc-segmented`, a radio group | The replay speed and the board's views stay groups of toggle buttons with `aria-pressed`, drawn like Vici's segmented control | A radio group would change the keyboard path and break the behaviour tests |
| Toggles the app owns | vici.js flips `aria-pressed` on `.vc-chip` and `.vc-button--toggle` | The legend's toggles, the view buttons and *Larger text* use neither class; the app's own code flips them | One owner per control, so a toggle never flips twice (`tests/smoke.mjs`, case *once*) |
| Dialogs | 85 vh high; vici.js closes a dialog on a click on its backdrop | Today's widths (880, 620, 1080 and 1000 px), the window's height less 48 px; the app owns Escape, the backdrop and the focus trap (`data-vc-dismissable="false"`) | The intro and the mode choice fit a 1280 × 720 projector without scrolling; a decision or a typed key is never dropped by a stray click |
| Menus | `.vc-menu[popover]`, fixed to the viewport by vici.js | `.vc-menu` without `popover`, opened under its toggle by the app | The control bar's dropdowns keep their keyboard paths and their place |
| Drawer tabs | `.vc-tabs` bound by vici.js | `.vc-tabs__list` without `.vc-tabs` | The app's tabs close the drawer when the open tab is clicked again |
| Audit table | `vc-table-wrap` scrolls sideways | It clips, and the drawer scrolls | The header row sticks while the audit scrolls with the drawer; its columns fit the drawer |
| The AI label's note | `vc-popover` with `popover`, placed by vici.js | The popover's look without the attribute, opened, placed and closed by `js/ai_label.js` | A toggletip that stays open until a click elsewhere or Escape and gives the focus back (Carbon for AI, Pickering) |
| Progress rail | Labels under the markers; `vc-step--done` in merlot | One line, each label beside its marker; done steps ticked in ink; the step that waits for you merlot with *Your decision* | The rail must not take height from the console; merlot means the person's turn, and a finished step is the agent's |
| Intro steps | Centred labels; Vici's current and done looks | Flush left; each step's hexagon in the tone of its moment (danger, fjord, honey, ink, success) | The steps' hints run to five lines, which read better flush left; the tones introduce the grammar |
| Recommended option | A tag in the card's head | Its tag sits on the card's top frame | Inter runs wider than the former Barlow: the four cards still fit a 1080p drawer with the title on two lines |
| KPI tiles | `vc-stat` has no tones; figures 1.75–2.25 rem; the note in `--vc-text-subtle` | A tile that shows a state takes that state's tone; figures 2.125 rem, 1.875 rem from 1700 px down; the note in `--vc-text-muted` | The strip turns from danger and honey to success as the run moves; the header keeps its height; the note (*400-day exposure, verified*) must read on a projector |
| Mode markings | Sentence case | SIMULATION and LIVE in capitals | Tests and the downloaded files rely on them |
| Simulation | No tape in Vici | A tape of `--vc-text` and `--vc-surface` stripes with the word SIMULATION | A replay must never pass for a live run, and Vici's honey now means *at risk* |
| Board selection and the board's toggles | Pressed controls in merlot (`--vc-accent-soft`, `--vc-accent`) | Ink: a 2 px `--vc-text` frame, ink ticks, the segmented look | Merlot sits close to danger; never among state colours |
| Board cells | `vc-cell` (a clip-path fill) | SVG hexagons | An outline that is dashed (not linked) or dotted (a look-alike) needs SVG |
| Disabled buttons | `pointer-events: none` | Pointer kept; the code ignores the click | The title still says why the button is off |
| Tooltips | Shown on hover and on any focus | On buttons with words, only while the words are hidden; not when a dialog moves the focus after a click | A tooltip that repeats the button's words, or pops up when a dialog opens, is noise |
| The group's hub and the band's accounts without words | Icon-only buttons are named by a Vici tooltip through `aria-labelledby` | Each keeps its full name as `aria-label`; the hub's name stands beside it, and a band account without words keeps the browser's title as its hover hint | The name says more than a tooltip should (spend, place, state, link), and Vici's tooltip would replace it |
| Scrollbars | The browser's | Thin, in the border tone, on the app's own scrolling panels (console, drawer, board) | Wide scrollbars take room from the console and the board on a 1280 px projector |

## 11. Icons to propose for Vici

The app draws these in Vici's style (`js/icons.js`), until Vici has them:

| Name | Drawing | Used for |
|---|---|---|
| `stop` | A square with chamfered corners | Abort; the rail's stop mark |
| `radar` | Two nested hexagons with a sweep line | Live sweep |
| `receipt` | A slip with a zigzag foot | A posting in the outbox |
| `memo` | A page with one chamfered corner and two lines | An internal memo in the outbox |
| `key` | A key with a hexagonal bow | The API key |
| `eye-off` | Vici's eye, struck through | Hide the key |
| `pulse` | A heartbeat line with sharp turns | Diagnostics |
| `building` | A company block with a flat roof | GlobalCorp's company codes |
| `list` | Three lines with hexagon dots | The portfolio view |
| `shield` | A shield with chamfered shoulders | "Actions stay drafts" |

## Sources

- Vici, Victor Pflüger's design system: https://victorpflueger.github.io/ViciDesign/ (release v1.0.0, `vici/README.md`)
- Machado, Oliveira & Fernandes (2009), *A physiologically-based model for simulation of color vision deficiency*, IEEE TVCG 15(6): https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html
- R colorspace, `simulate_cvd` (the matrices apply to linear RGB): https://www.rdocumentation.org/packages/colorspace/versions/2.1-2/topics/simulate_cvd
- CSS Color Module Level 4 (OKLab, the 0.02 just-noticeable difference): https://drafts.csswg.org/css-color-4/
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Victor Yocco, *Designing For Agentic AI: Practical UX Patterns For Control, Consent, And Accountability*, Smashing Magazine, 11 Feb 2026: https://www.smashingmagazine.com/2026/02/designing-agentic-ai-practical-ux-patterns/
- IBM Carbon for AI, AI label usage: https://carbondesignsystem.com/components/ai-label/usage/
- Heydon Pickering, *Tooltips & Toggletips*, Inclusive Components: https://inclusive-components.design/tooltips-toggletips/
- Google Design, *Expressive Design: Google's UX Research*: https://design.google/library/expressive-material-design-google-research
- VUMC Edge for Scholars, *Optimizing Colors for Projected Presentations*: https://edgeforscholars.vumc.org/optimizing-colors-for-projected-presentations
- Bach et al., *Dashboard Design Patterns*, IEEE VIS 2022: https://arxiv.org/abs/2205.00757
