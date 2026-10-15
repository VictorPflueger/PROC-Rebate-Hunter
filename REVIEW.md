# REVIEW — the Navigator, the Rebate Hunter overhaul, and their parity

This document has six parts:

1. **The Navigator: design and feature review.** An evidence-based review of the sister prototype (Navigator 1.1.0), written before the overhaul as its basis. Findings W24 and W25 were added while building the Rebate Hunter, W26 to W32 after its independent review.
2. **The Rebate Hunter before the overhaul** (Streamlit version 6.2) and its gaps against the Navigator.
3. **What the overhaul did.**
4. **Parity checklist:** every Navigator feature and its Rebate Hunter counterpart, with a status.
5. **Back-port recommendations** for the Navigator (W1–W32 and what the Rebate Hunter did about each).
6. **Decisions and open points.**

Line references in Part 1 point into the Navigator repository (`VictorPflueger/supply-chain-navigator`, after PR #3, commit `9353e17`, still its latest on 15 October 2026); everything else refers to this repository.

---

## Part 1. The Navigator: design and feature review

- **Subject:** Navigator — Supply Chain Disruption Navigator, version 1.1.0 (`js/config.js:6`), repository state after the merge of PR #3 "design-system-1.1" (13 Oct 2026).
- **Review date:** 14 October 2026.
- **Purpose:** an evidence-based assessment of design and features, as the basis for a sister prototype (procurement "Rebate Hunter") built on the same design and feature set.

**Method.** Every text file in the repository was read (88 files, about 19,300 lines; the two large data files and the generated token file were read for structure and sampled). Two checks were run with Node 22: `node tools/palette.mjs --check` (all 45 colour checks pass) and `node tools/check_world.mjs` (32/32 pass). Extra contrast pairs were computed with a scratch copy of the palette maths, and the simulation scripts were inspected programmatically (draft footers, step kinds). The Playwright suites were read; after the review, the smoke suite was run unchanged for side-by-side screenshots (8 of 8 cases pass). Paths are repository-relative; line numbers are the lines read in this review.

---

### File inventory

#### Application

| Path | Lines | Role |
|---|---:|---|
| `index.html` | 105 | The page: meta CSP, Leaflet preloads with SRI, styles, `defer` data scripts, module entry, layout skeleton, static boot screen |
| `favicon.svg` | 8 | Static burgundy logo (the one colour asset that cannot read tokens) |
| `.nojekyll` | 1 | Stops GitHub Pages from running Jekyll |
| `js/main.js` | 103 | Boot: checks data globals, loads Leaflet, imports the UI, installs error banners |
| `js/config.js` | 125 | Constants: version, API, models and prices, caps, FX, open-data endpoints, basemap, SRI, storage keys, UI defaults |
| `js/events.js` | 109 | Run-event bus, event contract, run-state labels, run ids |
| `js/state.js` | 61 | Small observable app state |
| `js/ui.js` | 269 | Orchestrator: components, controls, dialogs, producer choice, bus → state/map/drawer |
| `js/agent.js` | 517 | Live Claude tool-use loop: requests, downgrades, stop reasons, parallel tools, nudges, caps, audit records |
| `js/anthropic.js` | 353 | Key check, probes, streaming Messages client, `ApiError`, retries |
| `js/sse.js` | 62 | SSE reader for `fetch` bodies |
| `js/prompt.js` | 92 | System prompt and opening messages |
| `js/tools.js` | 579 | Tool schemas and executors with the code-enforced guardrails |
| `js/cost.js` | 55 | Usage → USD/EUR; run cost tracker |
| `js/keystore.js` | 52 | Session-only key, masking, format check, redaction |
| `js/world.js` | 427 | Indexed world model, route geometry, query helpers |
| `js/erp.js` | 248 | ERP-style queries returning compact JSON |
| `js/impact.js` | 697 | Deterministic day-by-day impact engine |
| `js/geo.js` | 252 | Open-data tools (Open-Meteo, USGS, EONET, PEGELONLINE) |
| `js/payoff.js` | 66 | Shared option figures, baseline and decision effects |
| `js/summaries.js` | 47 | One-line tool result summaries |
| `js/simulation.js` | 402 | Simulation player on the same bus |
| `js/sim_vars.js` | 64 | Engine-derived placeholders and template filling |
| `js/sim_check.js` | 234 | Static validator for simulation scripts |
| `js/recorder.js` | 231 | "Save run as simulation" |
| `js/world_check.js` | 178 | World, scenario, reference-case and script integrity checks |
| `js/run_facts.js` | 104 | Run facts and acceptance self-check |
| `js/audit.js` | 153 | Audit store and redacted JSON export |
| `js/audit_panel.js` | 129 | Audit tab |
| `js/diagnostics.js` | 164 | Endpoint self-tests, failure memory, privacy self-test |
| `js/diagnostics_view.js` | 106 | Diagnostics dialog, paid web-search probe |
| `js/console.js` | 395 | Agent console logbook |
| `js/progress.js` | 92 | Five-step progress rail |
| `js/handover.js` | 40 | "Your decision" vs "Your approval" |
| `js/ai_label.js` | 85 | AI label with toggletip |
| `js/kpi.js` | 211 | KPI strip with decision payoff |
| `js/controls.js` | 194 | Control bar and dropdown widget |
| `js/dialogs.js` | 202 | Mode, key, custom what-if and summary dialogs |
| `js/drawer.js` | 74 | Bottom drawer tabs |
| `js/options_panel.js` | 157 | Options tab |
| `js/outbox.js` | 116 | Outbox tab |
| `js/map.js` | 559 | Leaflet map |
| `js/popovers.js` | 142 | Map popovers from ERP queries |
| `js/intro.js` | 79 | "How Navigator works" window |
| `js/libs.js` | 80 | Leaflet loader with fallbacks and SRI |
| `js/md.js` | 136 | Escape-first Markdown renderer |
| `js/modal.js` | 60 | Accessible modal |
| `js/dom.js` | 94 | `h()` element factory and helpers |
| `js/icons.js` | 53 | Static SVG icons |
| `js/format.js` | 80 | Money, duration, date formatting |
| `css/tokens.css` | 110 | Generated colour primitives |
| `css/style.css` | 420 | Roles, type scale, layout, header, control bar, banners, boot, breakpoints, reduced motion |
| `css/components.css` | 212 | Buttons, segmented control, dropdown, chips, fields, AI label |
| `css/console.css` | 282 | Console, rail, simulation watermark, log entries, report card, Markdown |
| `css/drawer.css` | 186 | Drawer, option cards, comparison bars, outbox, audit table |
| `css/map.css` | 190 | Leaflet overrides, markers, legend, popovers |
| `css/modals.css` | 159 | Modals, mode cards, key dialog, Diagnostics, intro |
| `css/fonts.css` | 236 | 26 `@font-face` rules |
| `data/world.js` | 1259 | `window.WORLD`: 2 plants, 15 parts, 75 nodes, 33 routes, 57 suppliers, 25 alternatives, 47 POs, reference curves |
| `data/scenarios.js` | 73 | Six preset seeds with map focus and offline-only `exposure_check` |
| `data/reference_cases.js` | 152 | Engine specs per scenario: disruption with three variants, hypothesis |
| `data/sim_runs.js` | 1105 | Six authored scripts (31–36 top-level steps, four approval paths each, 53 drafts) |
| `data/basemap_offline.js` | 3 | Natural Earth land (99 polygons) and borders (159 lines), 211 kB |
| `design/tokens.json` | 1155 | Generated W3C Design Tokens (OKLCH with hex) and role aliases |

#### Tooling and tests

| Path | Lines | Role |
|---|---:|---|
| `tools/palette.mjs` | 306 | OKLCH palette generator and its 45 checks |
| `tools/check_world.mjs` | 27 | Node runner for `checkWorld` |
| `tests/run-all.mjs` | 38 | Runs the nine suites in order |
| `tests/lib/harness.mjs` | 101 | Static server, Playwright loader, Leaflet from `vendor/`, mock key |
| `tests/lib/fake-claude.mjs` | 111 | Scripted Messages API stand-in that validates every request |
| `tests/unit.mjs` | 110 | Streaming client and cost maths (Node only) |
| `tests/smoke.mjs` | 389 | Main flows and every loading failure mode |
| `tests/sims.mjs` | 164 | All six simulations, four decision patterns |
| `tests/live.mjs` | 557 | Live agent against the fake API, seven cases |
| `tests/accept.mjs` | 565 | Key lifecycle, Diagnostics fallback, Abort/Reset matrix, offline |
| `tests/layout.mjs` | 141 | Viewports and ≥ 40 px targets |
| `tests/design.mjs` | 207 | Colour grammar in the app; washout and colour-blind captures |

#### Documentation, third-party and binary assets

| Path | Lines | Role |
|---|---:|---|
| `README.md` | 199 | Overview, deployment, modes, key, costs, troubleshooting, recording, EU AI Act, files |
| `DESIGN.md` | 167 | Brief, methods, colour grammar, palette, checks, agentic patterns, projector rules |
| `TECH_NOTES.md` | 345 | Verified API facts, CORS probes, endpoints, CSP, decisions D1–D45, guardrails, test log, acceptance |
| `DATA_SOURCES.md` | 355 | Live sources, licences, invented vs anchored data, network, precedents, caveats |
| `DEMO_SCRIPT.md` | 145 | Eight-minute stage script, contingencies, Q&A |
| `tests/README.md` | 45 | Suites, set-up, options, ports |
| `vendor/leaflet-1.9.4/leaflet.js` | 5 | Minified Leaflet fallback (not reviewed line by line) |
| `vendor/leaflet-1.9.4/leaflet.css` | 661 | Leaflet stylesheet fallback |
| `vendor/leaflet-1.9.4/LICENSE` | 26 | BSD-2-Clause |
| `fonts/LICENSE-Barlow.txt`, `fonts/LICENSE-Barlow-Semi-Condensed.txt`, `fonts/LICENSE-IBM-Plex-Mono.txt` | 93 each | SIL OFL 1.1 |
| `fonts/*.woff2` (26), `vendor/leaflet-1.9.4/images/*.png` (5) | binary | Font subsets, Leaflet control images |

---

### 1. Summary

- **What it is.** A static, no-build ES-module single-page app in which an AI agent handles a supply-chain disruption for a fictional EV maker: detect, verify, quantify, propose three costed options against doing nothing, and draft outbound actions that each need human approval. The live Claude agent (presenter's own key, called from the browser) and a scripted Simulation feed one run-event bus.
- **The core idea is enforced in code.** Money and stop days come from a deterministic engine (`js/impact.js`); option cards are filled from engine variants by `variant_id` (`js/tools.js:445-468`), so the model cannot put a figure on a card or KPI tile.
- **The live client is protocol-correct.** It rebuilds assistant content exactly, echoes thinking signatures, handles `pause_turn`, `max_tokens`, mid-stream errors, truncated streams, retries and idle timeouts, and drops optional request features when the API refuses them. A fake API validates every request in the tests.
- **The modes are honest.** Simulation is labelled everywhere (hazard-tape badge, console watermark, report marker, audit `mode`), evidence is tagged "representative" or "recorded", and a checker rejects invented numbers, broken paths and live-run claims.
- **The design system is real.** One burgundy generates every colour in OKLCH; contrast and colour-blind separation are checked by a script that fails the build; a four-rule colour grammar (burgundy = human, violet = AI, red/amber/green = network, hazard yellow = simulation) is applied consistently.
- **Agentic UX patterns are done well:** a progress rail with hand-over states, "Your decision"/"Your approval", AI labels, visible self-correction with struck-through revisions, and run facts as a per-run acceptance check.
- **The test tooling is thorough for a prototype:** nine suites, including an Abort/Reset matrix, an offline simulation, key-lifecycle privacy checks and zero-CSP-violation assertions in every browser suite.
- **Weak: storage hygiene on a shared origin.** Seven `nav.*` storage keys, two outside the central `STORAGE` config, are not namespaced per app. On GitHub Pages all of a user's repositories share one origin, so the sister prototype would collide with Navigator and any same-origin page in the tab can read the API key.
- **Weak: some guarantees are stronger in the docs than in the code.** "Two independent sources" is a count of two model-supplied strings; the AI label on the management summary says every euro comes from the engine although the summary is free model text; Simulation booking drafts lack the AI footer every live draft carries.
- **Weak: robustness gaps.** One geo failure, even a 4xx caused by a model-chosen station name, disables that source for the whole tab session; live geo results read only "Result received"; the engine has no golden-value tests and nothing runs in CI.
- **Weak: duplication and hard-coding.** ERP tool dispatch exists three times; constants such as the 60-day look-ahead, plant ids and node ids are hard-coded in otherwise generic modules; `kpi_update.series` is computed and never used.
- **Found later (W24 to W32).** Building and reviewing the Rebate Hunter turned up more in the shared code: a decision is not tied to the set of options it was taken on, drafts are not tied to the approved option, and the summary's outcome is not tied to the decision; a retried response can leave its text on screen; keyboard focus is lost after a decision; Abort leaves open-data requests running; the key field works inside another site's frame; the offline basemap draws bands across the map, and the legend hides the subject of views the app sets.
- **Reuse verdict.** About half of the modules are a domain-neutral shell that can move into the Rebate Hunter almost unchanged once storage keys, copy and the tool registry are parameterised; the world model, engine, ERP and geo tools, prompt, map and scripts must be rewritten.

---

### 2. Architecture

#### 2.1 Overview

```
 data/*.js (classic scripts → window globals)        js/main.js (module)
   WORLD, SCENARIOS, REFERENCE_CASES,        ──►    check globals → loadLeaflet() → import ui.js
   SIM_RUNS, OFFLINE_BASEMAP                                        │
                          ┌─────────────── js/ui.js (orchestrator) ─┴───────────────┐
   Controls / dialogs ──► │ start(entry) → chooseMode → askApiKey → begin()          │
                          │     ├─ player.play(SIM_RUNS[id])   js/simulation.js      │
                          │     └─ agent.run({...})            js/agent.js           │
                          └───────────────────────────┬──────────────────────────────┘
                                                      │ bus.emit(type, payload)
                                       js/events.js  RunEventBus  (id, seq, type, ts, t, run_id, mode)
        ┌───────────────┬──────────────┬──────────────┼────────────┬────────────────┬──────────────┐
    console.js        kpi.js   options_panel.js   outbox.js   audit.js (onAny)   handover.js,   ui.js →
    (+progress)                                                 audit_panel,     ai_label.js    state/map/
                                                                recorder,                       drawer
                                                                run_facts
   Decisions: options_panel / outbox → ui.js → bus.emit("option_decision" | "action_decision")
              → queued by whichever producer is running
```

#### 2.2 Run-event bus with two producers

`js/events.js` is a synchronous publish/subscribe bus (`on`, `onAny`, `emit`) whose envelopes carry a sequence number, wall-clock and run-relative time, run id and mode (`js/events.js:76-90`). A failing subscriber is caught and logged so one broken view cannot break a run (`:93-100`). The header comment is the event contract (`:7-25`); `RUN_STATES` names the states (`:27-40`).

- **Live producer** (`js/agent.js`): a loop of streaming `/v1/messages` calls driven by `stop_reason`. Runs of independent `erp_*`/`geo_*` calls execute in parallel (`js/agent.js:281-300`); narration and reasoning are throttled to 45 ms (`:236-277`); tool executors in `js/tools.js` emit UI events through a guarded `emit` that drops anything after the run has ended (`:63`). Details in 4.4.
- **Simulation producer** (`js/simulation.js`): walks typed steps (`state`, `say`, `think`, `tool`, `web`, `geo`, `recordedTool`, `impact`, `alert`, `map`, `options`, `awaitOption`, `draft`, `awaitActions`, `report`, `notice`, `end`; `js/simulation.js:143-186`). ERP and `impact` steps re-run the real queries and the real engine (`:203-211`, `:263-288`), so a replay shows exactly what the live agent would compute for the same assumptions. Narration is streamed a few words at a time (`:188-201`); the replay speed is read on every wait (`:86-94`).
- **Decisions flow back on the same bus.** The options panel and outbox call into `ui.js`, which emits `option_decision`/`action_decision` only while a run is active (`js/ui.js:50-63`). Both producers subscribe from the start of the run and queue decisions (`js/agent.js:50-58`, `js/simulation.js:47-49`), so a quick double decision is never lost (D13).

#### 2.3 Deterministic engine

`js/world.js:21-177` builds an indexed model from `WORLD`: normalised flows with share, transit and route; input slots for plants and suppliers (material parts are consumed at tier-1 suppliers); modelled and unmodelled shares; the plants each site ultimately supplies; a topological order; route↔node indexes. `js/impact.js:26-71` compiles a disruption (capacity losses per supplier and day; route gaps that start when affected cargo would reach the destination, `js/world.js:204-228`) and up to six variants built from seven mitigation types (surge, airfreight, spot buy, alternative supplier, build-shy, reroute, input contingency), each validated against ERP constraints such as ramp-up and qualification days (`js/impact.js:198-320`). `run()` simulates every site day by day in topological order (`:360-490`); a plant runs at the rate of its scarcest input; lost output is costed as stop-equivalent days × line-stop cost. Results carry value at risk, first stop, per-part shortages, propagation and, per variant, mitigation cost, residual exposure and total (`:537-659`). Invalid inputs return field-level errors for the model to fix (`:37-43`, `:677-692`).

#### 2.4 Data as classic scripts

World, scenarios, reference cases, scripts and the offline basemap are classic scripts that set `window` globals (`index.html:30-34`). There is no same-origin `fetch`, so `connect-src` needs no `'self'`, the app works offline, and Node tools load the same files in a `vm` sandbox (`tools/check_world.mjs:12-17`) or with `new Function` (`tests/live.mjs:28-33`). A recorded run is another script appended to `data/sim_runs.js` (`js/recorder.js:69-82`).

#### 2.5 Boot sequence

1. A static boot screen covers the page (`index.html:80-103`); its help text appears after six seconds without script, which explains `file://` (`css/style.css:367-376`).
2. The `defer` data scripts and the module `js/main.js` execute in document order.
3. `main.js` names any missing data file on the boot screen (`js/main.js:9-23`), loads Leaflet through the fallback chain (`:25-28`) and imports `ui.js` dynamically so a broken module is reported, not a blank page (`:31-36`).
4. `initUI()` builds everything, error banners are installed with redaction (`:84-103`), the boot screen fades, the intro opens on a first visit (`:40-44`), and banners warn about missing Leaflet CSS or `file://` (`:46-51`).

#### 2.6 Module dependency overview

| Layer | Modules | Depends on |
|---|---|---|
| Foundation | `config`, `events`, `state`, `dom`, `icons`, `format`, `md`, `keystore` | nothing, or `config` |
| Network | `sse`, `anthropic`, `libs` | `config`, `sse` |
| Domain model and tools | `world`, `erp`, `impact`, `geo`, `payoff`, `summaries`, `prompt`, `tools`, `cost` | `world`; `geo` also imports `diagnostics` |
| Producers | `agent`, `simulation`, `sim_vars`, `sim_check`, `recorder` | domain layer, `events`, `audit` |
| Meta | `audit`, `run_facts`, `diagnostics`, `world_check` | `events`, `keystore`, `anthropic`, `libs` |
| UI components | `console` (+`progress`, `handover`, `ai_label`), `kpi`, `drawer`, `options_panel`, `outbox`, `audit_panel`, `map` (+`popovers`), `controls`, `dialogs`, `modal`, `intro`, `diagnostics_view` | `events`, foundation |
| Orchestration | `ui`, `main` | everything above |

Two couplings stand out: the geo tools import Diagnostics for their failure memory (`js/geo.js:8`), and Diagnostics pulls in the audit export, `world_check`, `sim_check` and the engine (`js/diagnostics.js:4-9`); the console reads the audit store to compute run facts (`js/console.js:11`, `:289`).

#### 2.7 State management

`js/state.js` is a 61-line store: `getState` returns a copy; `setState` merges a patch, notifies subscribers and persists `model` and `speed` to session storage (`js/state.js:21-36`); `isRunning`/`isFinished` derive from the run state (`:43-53`). `ui.js` subscribes one `render` for the control bar and mode badge (`js/ui.js:122-132`) and maps `state_change`/`run_end` onto `runState` (`:135-139`). Component state lives in closures (stopwatch, option status, drafts). Module-level singletons bound to the bus: the audit store (`js/audit.js:13-17`), the hand-over flag (`js/handover.js:8`), the AI-label run context (`js/ai_label.js:10-14`) and the Diagnostics memory in session storage (`js/diagnostics.js:29-46`).

#### 2.8 How the UI stays producer-agnostic

No view imports a producer; every view subscribes to event types, and the only producer selection is in `begin()` (`js/ui.js:195-220`). Both producers shape options, baselines and decision effects through `js/payoff.js` (`js/tools.js:465`, `:475`, `:496`; `js/simulation.js:306`, `:313`, `:333`) and console summaries through `js/summaries.js`. The UI does read the envelope's `mode` in more places than the README admits (W17): the badge (`js/ui.js:124-129`), watermark and run meta (`js/console.js:126-134`), cost tile (`js/kpi.js:62-65`), run-facts wording (`js/run_facts.js:98-102`, `js/console.js:293`), save button (`js/console.js:285`), AI-label authorship (`js/ai_label.js:18-22`) and report dialog (`js/dialogs.js:184`, `:192`). These are presentation differences, not producer coupling.

---

### 3. Design system

#### 3.1 Tokens

`tools/palette.mjs` derives every colour from `SOURCE = "#7a1e3a"` (`:35`): OKLCH conversion with Ottosson's matrices (`:37-90`); 12-step scales with one lightness ladder for steps 1–8 (`:112-114`) and per-family solids and text (`:120-128`); neutrals tinted with the brand hue; atmospheric hues harmonised towards burgundy by Material's rule (`:102-106`); fixed state hues of 29°, 57° and 170° (`:141-143`); gamut mapping by chroma only (`:81-89`). It writes `css/tokens.css` (hex with the OKLCH source in comments) and `design/tokens.json` (W3C DTCG with OKLCH components, hex fallback and role aliases; `:234-267`).

`--check` runs 45 checks and exits non-zero on any failure (`:269-306`): 32 WCAG 2.2 contrast pairs (`:156-176`), hue and lightness gaps between burgundy and danger (`:178-182`), nine colour-blind pairs simulated with the Machado et al. matrices in linear RGB with a minimum ΔEOK of 0.10 (`:187-212`), and two "files up to date" checks (`:293-299`). It is the first suite in `tests/run-all.mjs:9`. `css/style.css:15-87` maps primitives to roles; the map reads the state roles at start-up (`js/map.js:23-34`) and the logo is drawn from roles (`css/style.css:145-150`).

#### 3.2 Colour grammar

| Colour | Meaning | Applied in |
|---|---|---|
| Burgundy (`--brand`) | Identity and the human in charge | Primary and Approve buttons (`css/components.css:21-33`), waiting pill (`css/style.css:291-292`), rail "yours" (`css/console.css:54-55`), pending chips (`css/components.css:136`), recommended frame (`css/drawer.css:67`), decisions in console and audit (`css/console.css:225-227`, `css/drawer.css:159`), focus ring (`css/style.css:86`), plants (`css/map.css:59-72`), attention count (`css/drawer.css:33`) |
| Violet | The AI's voice | AI labels (`css/components.css:190-211`), Hypothesis/Revised (`css/console.css:131`, `:135`, `:147`), what-if alerts (`:215-216`), reasoning (`:246`), streaming cursor (`:155-158`), model calls in the audit (`css/drawer.css:162`), disclosure icon (`css/style.css:211`) |
| Red / amber / green | Network and outcomes | Map stroke, fill, size, glow (`js/map.js:298-335`, `css/map.css:73-97`, `:116-118`), KPI tints (`css/style.css:251-258`), Confirmed/Not confirmed (`css/console.css:133-134`), cost bars (`css/drawer.css:110-112`) |
| Blue (info) | Checking; money an option spends | Check tags (`css/console.css:132`), source links (`:198`), response-cost bar (`css/drawer.css:110`) |
| Hazard yellow and black | Simulation, outside the palette | Badge (`css/style.css:188-195`), console tape and watermark (`css/console.css:68-99`), mode card (`css/modals.css:55-65`), defined once in `css/style.css:57-59` |
| Danger red on buttons | Destructive actions only | Abort, Forget key (`css/components.css:25-26`; `js/controls.js:53`; `js/dialogs.js:81`) |

Every state also has a second cue: a word in chips and popovers (`js/popovers.js:9-15`), a larger marker or heavier line (`js/map.js:303-309`, `:322`), an icon in the console.

#### 3.3 Typography

Three self-hosted families, so no request goes to a font service (D11): Barlow for the UI (400/500/600/700, italic 400/600), Barlow Semi Condensed for figures and headings (500–800), IBM Plex Mono for tool names, JSON and keys (400–600), each in latin and latin-ext subsets selected by `unicode-range` (26 rules in `css/fonts.css`, `font-display: swap`). Roles are `--font-ui`, `--font-figures`, `--font-mono` (`css/style.css:65-67`). The root size is fluid, `clamp(15px, 0.48vw + 8px, 18px)`, about 17 px at 1920 px (`:90-93`), with a seven-step scale up to `--fs-kpi` (`:69-74`) and tabular lining numerals for figures (`:126`, `:247`).

#### 3.4 Layout

The body is a four-row grid: header, control bar, workspace, drawer (`css/style.css:98-112`). The **header** holds the brand, badges (mode, the permanent "You are interacting with an AI system" disclosure, "How it works") and four KPI tiles; badges wrap rather than overlap the tiles (`css/style.css:132-263`, D38). The **control bar** has Start agent, Scenario, Live scan, Model, Replay ×1/×2/×4, the status pill, Abort, Reset and Diagnostics (`js/controls.js:60-71`); captions collapse below 1600 px (`css/style.css:388-395`). The **workspace** is map 60 % and console 40 % (`:302-308`), stacked below 860 px (`:408-416`). The **drawer** has Options, Outbox and Audit tabs, a permanent "Actions stay drafts…" note and a body of `min(44vh, 460px)` (`css/drawer.css:3-45`). **Banners** sit under the header (`css/style.css:311-328`); the **boot screen** and **modals** overlay the page.

#### 3.5 Components

- **Buttons**: primary, approve, brand-outline (non-recommended approvals), neutral reject, ghost, danger, small and icon sizes; disabled through `aria-disabled` so reason tooltips work (`css/components.css:3-52`, `js/dom.js:57-67`).
- **Chips** with tones (`css/components.css:124-144`) and **KPI tiles** with tone tints and a flip animation (`js/kpi.js:22-59`, `css/style.css:228-263`).
- **Option cards**: letter, title, recommended chip, description, figures, expected total, residual risk, actions or final status; the do-nothing card is dashed on porcelain (`js/options_panel.js:61-110`, `css/drawer.css:59-99`). **Comparison bars** stack response cost (blue) and remaining exposure (amber) against doing nothing (red), with a text summary as the `role="img"` label (`js/options_panel.js:32-53`, `css/drawer.css:101-118`).
- **Outbox cards**: type icon, recipient, status chip, AI label, subject, clipped body with "Show full draft", Approve/Reject, "Approve all N pending" (`js/outbox.js:23-75`, `css/drawer.css:120-145`).
- **AI label**: a 24 px violet chip in a 40 px button opening a fixed-position note that closes on outside click, Escape (focus returns), resize or wheel (`js/ai_label.js:39-85`).
- **Progress rail**: ordered list with number/tick/user/stop marks, a "Your decision"/"Your approval" chip, `aria-current="step"` and spelled-out state (`js/progress.js:43-70`); labels collapse through a container query (`css/console.css:22`, `:61-65`).
- **Status pill** (active, waiting, done, stopped; `css/style.css:279-296`, `js/controls.js:9-12`), **legend** that folds away on a short map until the presenter chooses (`js/map.js:473-522`), **modals** (`css/modals.css`), and **console entries** with types for run, phase, narration, reasoning, tool call, alert, decision, report and notice (`css/console.css:101-235`).

#### 3.6 Motion and reduced motion

Motion is sparse and purposeful: KPI flip, pulsing live and status dots, a pulsing active rail step, entry fade, a stroke flash on newly affected map elements, the streaming cursor, modal fade, drawer transition and map fly-to (`css/style.css:198`, `:259-263`; `css/console.css:52`, `:107-109`, `:155-158`; `css/map.css:119-120`). A global `prefers-reduced-motion` rule neutralises CSS animation (`css/style.css:418-420`), and JS checks the same preference for map flashes, fly-to and smooth scrolling (`js/map.js:291`, `:412`, `:433`; `js/console.js:91`).

#### 3.7 Accessibility features

A skip link to a focusable console (`index.html:38`, `:73`); labelled landmarks (`index.html:40-76`); live regions for the console log (`js/console.js:48`), status pill and badge (`js/controls.js:51`, `index.html:57`) and banners, with `role="alert"` for errors (`js/ui.js:261`); a modal with focus trap, Escape, focus restore, `aria-modal` and `aria-labelledby` (`js/modal.js:12-58`); keyboard dropdowns (`js/controls.js:166-177`); `aria-pressed`, `aria-expanded` and `aria-current` on stateful controls; HTML targets of at least 40 px (`--hit: 44px`, tested by `tests/layout.mjs:80-131`); a 2 px burgundy ring outside a 2 px white gap (`css/style.css:86`, `:119`); and no meaning by colour alone.

#### 3.8 Projector features

"Larger text" enlarges the console log only (`js/console.js:33-44`, `css/console.css:16-18`); the fluid root scales the UI; pastels only fill, with meaning in deeper strokes; options are reviewed under a simulated washout and colour-blind filters (`tests/design.mjs:26`, `:142-196`); layouts are tested from 1920×1080 down to 1280×720 including 1536×864 (`tests/layout.mjs:56`).

---

### 4. Features

#### 4.1 Simulation vs Live mode choice

`start()` asks how to run unless the entry is a Live scan (`js/ui.js:154-185`). `chooseMode` offers two cards, Simulation (hazard-tape top; no key, no cost, offline apart from tiles) and Live (burgundy; own key, a few tens of cents), a "Will run:" line and, when a key is stored, "Change or forget key" (`js/dialogs.js:16-61`). Simulation is disabled with a reason for custom what-ifs (`js/ui.js:166-169`).

#### 4.2 API key handling

The dialog masks the input with a show/hide toggle, checks the format (`js/keystore.js:7`) and validates with the free `GET /v1/models` (`js/anthropic.js:73-89`). It explains 401s and workspace errors; on a network/CORS failure it stores the key and says so (`js/dialogs.js:87-117`); it advises a dedicated workspace with a spend limit (`:135-140`) and offers Forget key (`:121-128`). Storage is session-only with an in-memory fallback (`js/keystore.js:10-36`); the mask shows the first seven and last four characters (`:44-47`); `redactSecrets` scrubs banners, audit rows, exports and recordings (`:50-52`; `js/main.js:87`; `js/audit.js:129`, `:147-153`; `js/recorder.js:81`). The CSP limits `connect-src` to Anthropic and four open-data hosts (`index.html:8`). A 401 during a run removes the key (`js/agent.js:382-384`, `js/ui.js:68-71`).

#### 4.3 Model choice and per-model settings

`MODELS` holds label, hint, effort, `max_tokens` and USD prices: Sonnet 5.5 (default, medium, 16,000), Haiku 5.5 (medium, 12,000, a second price tier above 100k prompt tokens), Opus 5.5 (high, 16,000; `js/config.js:25-43`). The dropdown persists per tab and is locked while running or in Simulation (`js/controls.js:36-42`, `:97-99`; `js/state.js:14`, `:33`); requests send the model's effort and `max_tokens` (`js/agent.js:220-233`).

#### 4.4 Streaming client

- Exact headers including `anthropic-dangerous-direct-browser-access` (`js/anthropic.js:8-16`); `fetch` with `no-store`, `credentials: "omit"`, `referrerPolicy: "no-referrer"` (`:171-179`).
- The SSE reader handles LF/CRLF split across chunks and multi-byte characters and keeps an idle timer (`js/sse.js:9-46`); the 90 s limit also covers the wait for headers (`js/anthropic.js:165-186`).
- Reconstruction keeps blocks exactly as sent: text and thinking deltas, `input_json_delta` parsed at block stop (unparsable input marks the block incomplete), signatures, citations, cumulative usage, and `error` events raised as `ApiError` (`:203-280`, `:306-313`). A body without a stop reason is an interrupted connection and is retried (`:292-296`, D23).
- Retries cover transient statuses and network errors, honour `retry-after` up to 20 s, otherwise wait 1.5 s then 4 s, at most twice; spend-limit 429s are never retried (`:57-67`, `:331-353`). Retries are announced in the console (`js/agent.js:185-188`).
- Degradation: a 400 about web search removes the tool, rebuilds the prompt, shows a banner and disables Live scan; 400s naming `output_config`/effort, `display`, `thinking` or `cache_control` drop that field, at most four times (`js/agent.js:192-212`).
- Stop reasons: an incomplete tool call under `max_tokens` is discarded and the turn retried once at 1.5× (capped at 128k; `:110-116`), otherwise "Continue from where you stopped." is appended (`:130-133`); `pause_turn` resends with the paused content last (`:121`); refusals and context overflow stop cleanly (`:134-139`).
- Each exchange is audited with appended user messages, parameters, content, usage, request id and duration; signatures, redacted thinking and encrypted search content are stripped; the system prompt and tool schemas are logged once (`:482-516`).

#### 4.5 Cost meter and caps

`usageCostUsd` prices uncached input, cache writes and reads, output and web searches ($10 per 1,000), picks Haiku's long-prompt tier, and converts at a fixed 0.894 EUR/USD (`js/cost.js:18-32`, `js/config.js:54`). `cost_update` follows every response (`js/agent.js:99-100`). The "Session cost" tile shows the total and "this run"/"last run", persists in the tab and adds the Diagnostics probe (`js/kpi.js:61-72`, `:157-174`, `:189-194`; `js/ui.js:99`). Caps: 40 model calls (`js/agent.js:87-89`) and €3 per run (`:104-107`).

#### 4.6 Guardrails enforced in code

| # | Guardrail | Where |
|---|---|---|
| 1 | A `verified` alert needs at least two sources, otherwise an error; unverifiable seeds run as `what_if` | `js/tools.js:401-406`; scripts `js/sim_check.js:137` |
| 2 | Unknown ids are dropped from alerts and map marks and reported back | `js/tools.js:407`, `:415-417`, `:432-442` |
| 3 | Exactly three options, distinct `variant_id`s of the latest `sim_impact`, which must have variants (D25) | `js/tools.js:241-245`, `:446-468`; scripts `js/sim_check.js:152-171` |
| 4 | Option and KPI figures come only from the engine | `js/tools.js:386-396`, `:465`; `js/payoff.js:6-30`; placeholders checked by `js/sim_check.js:83-86` |
| 5 | Decisions block with no request in flight and return as tool results with the next step spelled out | `js/tools.js:488-514`; `js/agent.js:342-366` |
| 6 | Drafts only after an approved option | `js/tools.js:523`; scripts: drafts only in approval paths, `js/sim_check.js:191` |
| 7 | AI footer and "Mock booking…" line added in code after truncation | `js/tools.js:524-526` |
| 8 | Report refused while a draft is pending | `js/tools.js:554-555`; scripts `js/sim_check.js:231-232` |
| 9 | "Live agent run" marker on every live report; replay marker swapped in by the recorder; scripts must be marked and never claim to be live | `js/tools.js:558-559`; `js/recorder.js:221-225`; `js/sim_check.js:210-211` |
| 10 | Step cap of 40 model calls | `js/agent.js:87-89`; `js/config.js:47` |
| 11 | Budget cap of €3 per run | `js/agent.js:104-107`; `js/config.js:48` |
| 12 | 90 s idle timeout, header wait included | `js/anthropic.js:167`, `:283`; `js/config.js:49` |
| 13 | Early `end_turn`: two visible nudges, then **Stopped** | `js/agent.js:145-155`, `:444-456` |
| 14 | Nothing reaches the UI after Abort/Reset: guarded emits, flushed narration, dropped late tool results, rejected waits | `js/agent.js:63`, `:239-248`, `:255-256`, `:314-315`, `:406-415`; `js/simulation.js:65-94` |
| 15 | Ended runs show options and drafts as undecided without buttons; decisions outside a run are refused | `js/options_panel.js:139-144`; `js/outbox.js:97-102`; `js/ui.js:52`, `:59` |
| 16 | Length caps on model-written fields; only http(s) source URLs | `js/tools.js:410-414`, `:462-464`, `:521`, `:556`, `:572-579`; `js/console.js:388-395` |

#### 4.7 Live scan

The button starts a live run without the mode dialog (`js/ui.js:84`, `:164-171`). The opening message lists the supplier footprint and plants, asks for real events from the last 14 days and requires an honest "no material disruption" report if nothing qualifies (`js/prompt.js:72-85`, `js/erp.js:40-53`). Web and geo calls keep the phase "Scanning" (`js/agent.js:328`), the nudge has a scan variant (`:452-454`), the button is disabled when web search is known to be off (`js/controls.js:91-95`, D21), and `no_material_disruption` ends the run as `no_findings` (`js/agent.js:144`).

#### 4.8 Custom what-if

"Custom what-if…" opens a text dialog (20–800 characters; `js/dialogs.js:159-180`); the text becomes the seed and the opening message's "Triggering observation (unverified)" (`js/ui.js:89-92`, `:200`; `js/prompt.js:86-91`). Simulation is blocked (`js/ui.js:168`).

#### 4.9 Preset scenarios and reference cases

Six seeds are written as unverified first signals with a map focus and an `exposure_check` that only the integrity check reads (`data/scenarios.js:1-73`). `data/reference_cases.js` holds each post-verification disruption with three variants and an optional hypothesis; Simulation runs them by name (`js/simulation.js:263-288`) and `js/world_check.js:121-140` proves each one bites. The live agent never sees them.

#### 4.10 Simulation scripts, checker and placeholders

Scripts never type an engine figure: they write `{{var}}`, `{{first_stop_date}}`, `{{V2.total}}`, `{{part.P-SEAT.shortage_day}}` or `{{date:+5}}`, filled from the latest engine result at playback (`js/sim_vars.js:12-54`). `js/sim_check.js` walks every step and branch (`:74-223`): known kinds and states, ERP calls that succeed, engine specs that run, placeholders that resolve at that point, verified alerts with two sources, options covering exactly the three costed variants with a valid recommendation, approval and rejection paths for every option and for accepting the risk, drafts before the outbox wait and the report after it, the AI footer on non-booking drafts, and the simulation marker. Authored scripts must also show a "Hypothesis:", a visible "Revised:", two pieces of evidence before the alert and at least eight tool calls (`:64-69`). It runs in Diagnostics, `tools/check_world.mjs` and the recorder.

#### 4.11 Recorder

After a completed live run of a preset scenario with a report (`js/recorder.js:21-30`), `toSteps` converts the audit's event stream into a script: narration and reasoning deduplicated by message id, re-executable ERP steps, geo and web results as recorded evidence, engine specs as `impact` steps so euros are recomputed, alerts, map marks, the agent's own options, drafts and report (`:91-218`). Branches follow the agent's view of each decision, not the click (D27; `:149-168`); the live marker becomes the replay footer (`:221-225`); the result is validated and downloaded for appending to `data/sim_runs.js` (`:57-87`).

#### 4.12 Run facts

`computeRunFacts` derives run and agent time (excluding time awaiting the human), tool calls by kind, labelled verification and revision paragraphs, evidence before the alert, decisions, drafts, cost and three acceptance checks (`js/run_facts.js:12-87`). It is the console's last line, "Run facts:" or "Replay facts:" (`js/console.js:286-293`), and part of the export (`js/audit.js:123`).

#### 4.13 Audit log and JSON export

Every bus event except partial narration and reasoning is cloned and redacted into the audit (`js/audit.js:19-37`); each model exchange adds a `model_call` row (`:66-92`). The Audit tab is a chronological table with filters (All, Agent, Tools, Model calls, Human decisions, System; `js/audit_panel.js:10-17`) and readable summaries (`:99-124`). The export carries version, mode with a plain-language statement, AI disclosure, run info, run facts, cost, counts, events and API exchanges, redacted again, in a file named `-LIVE` or `-SIMULATION` (`js/audit.js:102-135`).

#### 4.14 Diagnostics

Rows cover the Anthropic API (a keyless 401 probe proving CORS, or the free key check listing missing models), the four open-data services with response validators, a tile image probe, the Leaflet source and SRI, world integrity, and "Key and privacy" (`js/diagnostics.js:11-143`). The privacy row parses the CSP and fails if `connect-src` allows any host beyond the five documented ones, scans local storage for key-shaped values, proves redaction and checks the audit export (`:114-136`). Network rows are remembered in session storage (`:145-152`) and `geo_*` tools skip remembered failures with `fallback_hint: "use web_search"` (`js/geo.js:12-38`). An optional paid probe on Haiku (about €0.0001) tests whether web search is allowed (`js/anthropic.js:114-134`, `js/diagnostics_view.js:31-45`). The footer shows the version (`js/diagnostics_view.js:89`).

#### 4.15 Open-data tools

`geo_weather` (Open-Meteo daily data, WMO codes in words, flags for rain ≥ 40/80 mm, gusts ≥ 75/100 km/h, snow and heat, sites within 60 km; `js/geo.js:65-108`); `geo_earthquakes` (USGS summary feeds by magnitude and window, events within 300 km; `:112-146`); `geo_natural_events` (NASA EONET v3 open events with latest geometry, within 250 km; `:150-195`); `geo_rhine_level` (PEGELONLINE current value and seven-day trend, plus an estimated barge capacity at Kaub from the world's reference curve; `:199-248`). Each resolves rather than throws and returns `{error, fallback_hint}` on failure.

#### 4.16 Map

Panes order offline land, supply links, corridors, alternative paths, nodes, orders, suppliers and plants (`js/map.js:80-85`). Corridors are drawn per leg with a style per mode and great circles for air (`:35-42`, `:153-174`); 14 key nodes carry permanent labels hidden at low zoom (`:43-50`, `:193-198`; `css/map.css:108`); orders in transit sit on their current leg (`js/map.js:204-218`); suppliers are tier-sized on a slate ramp; alternatives appear when shown or marked (`:220-242`); plants are burgundy, keyboard-focusable markers (`:244-256`). States change stroke, fill, size and glow and flash once when newly affected; marking a route marks its orders (`:286-389`). Popovers use the agent's ERP queries (`js/popovers.js`). OSM tiles are desaturated by CSS (CARTO with a key); CARTO falls back to OSM after four failed tiles, and after six failures without a load a status names the offline coastline map (`js/map.js:96-120`), drawn on a canvas under the tiles (`:461-471`). Leaflet loads from unpkg, jsDelivr, then `vendor/`, with one SRI hash and a 7 s timeout per source (`js/libs.js:14-80`, `js/config.js:97-111`); without Leaflet the map becomes a notice (`js/map.js:552-559`). The last requested view is re-applied on resize until the presenter pans (D20; `:71-78`, `:416-421`).

#### 4.17 Intro window

Five steps (Spot, Check, Calculate, Propose, Prepare) and three value points in under 200 words (`js/intro.js:13-25`), opened once per browser after boot (`js/ui.js:249-251`, `js/main.js:44`) and from "How it works"; during a run it offers Close only (`js/ui.js:111-119`).

#### 4.18 Console logbook rendering

Entries are time · mark · body (`js/console.js:113-118`). Narration splits on blank lines or before a label (`:324-327`), and labelled kinds are styled: Hypothesis, Check, Confirmed, Not confirmed (also Unconfirmed, Unverified, Uncertain), Revised (also Revision, Correction, Self-correction), Finding (also Impact, Hidden dependency), Recommendation (`:17-25`). "Revised: old → new" renders the old text struck through, an arrow labelled "replaced by" and the new text in bold (`:337-344`; `css/console.css:150-152`). Reasoning summaries sit in collapsed `<details>` (`js/console.js:164-175`). Tool calls show the name in mono with an argument summary, special for `sim_impact` (`:177-185`, `:352-367`); results expand to JSON truncated at 9,000 characters with sources tagged "(representative)" or "(recorded …)" (`:187-214`). Alerts are cards, violet for what-ifs (`:216-228`); options, drafts and the report add buttons (`:230-268`); decisions read "You approved …" in burgundy (`:237-258`); the run's end shows status, reason, run facts and "Save run as simulation" (`:275-298`). The log follows new entries until the presenter scrolls, with "Jump to latest" (`:68-92`).

#### 4.19 KPI tiles and the after-decision payoff

Value at risk (horizon exposure, first or latest estimate), First line stop in (days, plant and date; affected when ≤ 14 days), Detection → decision (a stopwatch that follows the phase and freezes at the approval or the report) and Session cost (`js/kpi.js:32-174`). On approval, `decisionEffects` sends the option's residual exposure and first stop and turns exposed plants green or amber (`js/payoff.js:37-60`); the tile then reads, for example, "€1.9M, left with option B (was €19.1M)" (`js/kpi.js:130-149`). Accepting the risk only annotates the tiles.

#### 4.20 Hand-over labels

One flag records that options are on the table and none is approved (`js/handover.js:8-23`); `runStateLabel` turns `awaiting_approval` into "Awaiting your decision" or "Awaiting your approval" (`:31-34`), used by the pill, the console phase lines and the rail with its chip (`js/controls.js:73-76`, `:108`; `js/console.js:147`; `js/progress.js:34-41`).

---

### 5. Testing and tooling

| Suite | What it proves | How it serves the app |
|---|---|---|
| tokens (`tools/palette.mjs --check`) | 32 contrast pairs, brand vs danger, 9 colour-blind pairs, token files current | Stops the palette and its promises drifting |
| world (`tools/check_world.mjs`) | 32 checks: model builds, counts, sourcing, shares, consumers, cover spread, alternatives, POs, coordinates, scenario exposure, reference cases bite, six valid scripts | Keeps the synthetic world and the Simulation stage-safe |
| unit (`tests/unit.mjs`) | SSE parsing under three chunkings (LF, CRLF, one chunk), signatures, incomplete tool input, mid-stream error, 429 with `retry-after`, spend limit not retryable, retry success, abort, truncated streams, cost maths for all three models | Locks down the protocol code that is hardest to test in a browser |
| smoke (`tests/smoke.mjs`) | Full Tangier simulation with export; 401 then accepted key and two nudges ending Stopped; Diagnostics and version; intro; CDNs down; no Leaflet; `file://`; missing data file | Main flow and every loading failure |
| sims (`tests/sims.mjs`) | Six scripts with reject, approve, accept-the-risk and reject-all plans; no unresolved placeholders, no live claims, no network beyond tiles, KPI payoff, rejections recorded | Each scripted path plays and stays honest |
| live (`tests/live.mjs`) | Full run against the fake (parallel tools, `pause_turn`, 529 retry, two-source alert, rejection then approval, `max_tokens` retry, drafts, report, audit, cost equal to the usage maths, recording and replay); web search off; geo 503; quick second decision; abort mid-call; 401; empty scan | Protocol and guardrails without a real key |
| accept (`tests/accept.mjs`) | Key lifecycle (session only, new tab clean, DOM/console/export clean, key only in the `x-api-key` header to Anthropic, Change or forget key); Diagnostics flag → no request to the blocked host and web-search fallback; seven Abort/Reset paths; offline Simulation | The acceptance checklist in `TECH_NOTES.md` §11 |
| layout (`tests/layout.mjs`) | No overflow, badges never overlap KPIs, header height, one-row control bar at five viewports; HTML targets ≥ 40 px in seven states | Projector and laptop layouts |
| design (`tests/design.mjs`) | Map strokes and legend use state tokens; pill, rail and console hand-over labels; AI labels; washout and colour-blind captures | The grammar in the running app |

**Fake Claude stand-in** (`tests/lib/fake-claude.mjs`). It streams realistic SSE per scripted step (`:5-29`) and validates every request (`:59-87`): the key, version and direct-browser headers; `stream: true`; `max_tokens`; `tool_choice: auto`; at least 18 tools; a system prompt naming Nordwerk; every earlier assistant turn passed back deep-equal to what was sent, signatures and search blocks included; every `tool_use` answered in the next user message with `tool_result` blocks first and alone. Steps can return errors, cut a tool input (`cut`), mark a turn the agent must discard (`discard`), delay (`delayMs`) and carry per-request `expect` checks; an exhausted script and unrequested steps both fail the case (`tests/live.mjs:543-551`).

**Harness** (`tests/lib/harness.mjs`). A static server with path blocking to simulate missing files (`:57-78`), Leaflet CDN requests answered from `vendor/` (`:81-89`), a mock key that secret scanners ignore (`:95`) and an intro skip (`:101`). Every browser suite fails on a CSP violation, page error or unexpected console error (for example `tests/smoke.mjs:23-26`, `:43-51`), which makes the CSP a tested contract.

**Gaps.** No CI exists (no `.github/` directory). There are no golden-value engine tests (W7), no automated accessibility audit or keyboard-only flow, no unit tests for `js/md.js`, `js/erp.js` (the D19 country-code fix) or `js/sim_vars.js`, no test of storage isolation between apps on one origin, and only Chromium runs. Tests hard-code storage keys (`tests/lib/harness.mjs:101`, `tests/accept.mjs:173`) and the fake checks domain specifics (`tests/lib/fake-claude.mjs:66-67`).

---

### 6. Documentation

- **`README.md`**: what Navigator is and why it matters, an architecture sketch, five-minute GitHub Pages deployment (including the 100-file upload limit and `.nojekyll`), local serving, reading the screen, the two modes, key advice with workspace spend limits, costs per model, troubleshooting, recording a live run, EU AI Act alignment, quality checks and a file map.
- **`DESIGN.md`**: the brief; the methods and what each decided (OKLCH, Radix steps, Material harmonisation, Okabe–Ito and Machado, DTCG tokens, WCAG 2.2, agentic patterns, Carbon AI labels, Material 3 Expressive emphasis, projection); the grammar; the palette method; the 45 checks with results; Yocco's six agentic patterns mapped to features; projector rules; design tests; a change guide.
- **`TECH_NOTES.md`**: verified model IDs and prices, web-search tool versions and errors, browser CORS probe results, request parameters and thinking/effort rules, streaming and stop-reason handling, an error table, open-data endpoints, tile policy, libraries, fonts and CSP, decisions D1–D45, guardrails, the simulation format, a verification log and the acceptance checklist with evidence.
- **`DATA_SOURCES.md`**: live sources and licences, map layers, invented versus anchored data (company, BOM, 57 suppliers with real cluster anchors, 25 alternatives), 75 nodes and 33 corridors, reference figures, scenario precedents, engine assumptions, presenting caveats (Open-Meteo is non-commercial, OSM tiles, EONET) and what is not used.
- **`DEMO_SCRIPT.md`**: audience and goal sentence, recommended run, pre-flight, an eight-minute timeline, what to say at each console moment, decision and outbox, an audience what-if, contingencies and Q&A.
- **`tests/README.md`**: suites, Playwright set-up outside the app, options, ports.

The documentation is unusually complete and decision-oriented; its drift is listed in W17.

---

### 7. Findings

#### 7.1 Strengths

| # | Strength | Evidence |
|---|---|---|
| S1 | The number boundary is enforced where it matters most: cards and KPI tiles cannot show a model-typed figure, and options against a superseded impact run are refused | `js/tools.js:445-468`, `:450-452`; `js/payoff.js:6-30`; `js/tools.js:386-396` |
| S2 | Protocol fidelity: blocks rebuilt exactly, signatures echoed, cut-off tool calls dropped, truncated streams retried, all checked per request by the fake API | `js/anthropic.js:203-296`; `js/agent.js:118-119`, `:423-426`; `tests/lib/fake-claude.mjs:68-86` |
| S3 | Abort/Reset hygiene: nothing from an ended run reaches the next one, covered by a seven-path matrix | `js/agent.js:63`, `:239-248`, `:314-315`; `js/simulation.js:86-94`; `tests/accept.mjs:337-504` |
| S4 | One bus with failure-isolated subscribers and shared shaping gives both producers one interface | `js/events.js:76-100`; `js/ui.js:134-151`; `js/payoff.js:1-3` |
| S5 | Graceful degradation: web search removed with a rebuilt prompt and banner, optional fields dropped one at a time, open-data failures turned into tool errors with a fallback | `js/agent.js:192-212`; `js/geo.js:36-38`; `js/ui.js:72-79` |
| S6 | Safety lines are guaranteed in code, not requested in the prompt, and swapped consistently by the recorder | `js/tools.js:524-526`, `:558-559`; `js/recorder.js:221-225` |
| S7 | Simulation cannot show an unresolved engine figure or a broken path: placeholders filled at playback and checked statically, also in Diagnostics | `js/sim_vars.js:44-64`; `js/sim_check.js:83-86`, `:173-193`, `:225-233`; `js/diagnostics.js:137-142` |
| S8 | Key handling in depth: session storage, masking, redaction on every export path, CSP `connect-src` limited to five hosts, a self-test the presenter can run | `js/keystore.js:10-52`; `js/audit.js:129`, `:147-153`; `index.html:8`; `js/diagnostics.js:114-136` |
| S9 | Robust loading: two CDNs then a vendored copy under one SRI hash, an offline basemap, a boot screen that names missing files and explains `file://` | `js/libs.js:14-80`; `js/map.js:461-471`; `js/main.js:9-36`; `index.html:80-103` |
| S10 | A generated, test-gated palette with a grammar applied consistently | `tools/palette.mjs:130-212`, `:293-306`; `css/style.css:15-87`; `tests/run-all.mjs:9` |
| S11 | Model output can never inject markup: escape-first Markdown and a `textContent`-only DOM factory | `js/md.js:1-5`, `:88-122`; `js/dom.js:1-31` |
| S12 | Decisions queued from the start of a run; the recorder follows the agent's view, so quick double decisions are safe | `js/agent.js:50-58`; `js/simulation.js:47-49`; `js/recorder.js:149-168`; `tests/live.mjs:371-426` |
| S13 | Visible reasoning on stage: labelled paragraphs, struck-through revisions, collapsed reasoning, AI labels with authorship by mode | `js/console.js:17-25`, `:329-350`; `js/ai_label.js:18-37` |
| S14 | Run facts make acceptance measurable on every run and are exported | `js/run_facts.js:12-87`; `js/console.js:286-293`; `js/audit.js:123` |
| S15 | Honest evidence labels in Simulation: "representative" or "recorded <date>" on every source and reading | `js/simulation.js:213-252`; `js/console.js:126-131`, `:206` |
| S16 | Stage-aware UX: Diagnostics before going on stage, failure memory steering tools to web search, "Larger text", a view that survives the drawer | `js/diagnostics.js:11-21`; `js/geo.js:12-15`; `js/console.js:33-44`; `js/map.js:71-78`, `:416-421` |
| S17 | The CSP is a tested contract: every browser suite fails on a violation | `tests/smoke.mjs:23-26`, `:48`; `tests/sims.mjs:44-47`, `:162`; `tests/live.mjs:65-68`, `:550` |

#### 7.2 Weaknesses, risks, bugs and inconsistencies

| ID | Severity | Title |
|---|---|---|
| W1 | High | Storage keys not namespaced on a shared GitHub Pages origin; two keys bypass the config |
| W2 | Medium | "Every figure comes from the engine" is claimed for free model text |
| W3 | Medium | "Two independent sources" is a count of two strings |
| W4 | Medium | One geo failure, even a model-induced 4xx, disables the source for the tab session |
| W5 | Medium | Simulation booking drafts lack the AI footer |
| W6 | Medium | Live geo results read only "Result received" |
| W7 | Medium | No golden-value engine tests and no CI |
| W8 | Medium | Streaming narration re-rendered inside an `aria-live` log |
| W9 | Low–medium | Palette checks do not match the role mapping; two real contrast shortfalls |
| W10 | Low–medium | "New run" wipes the finished run before the mode is confirmed |
| W11 | Low–medium | Map entities are mouse-only and far below the 40 px claim |
| W12 | Low | `kpi_update.series` computed, emitted, never used |
| W13 | Low | Hard-coded ids and magic numbers in generic modules |
| W14 | Low | Duplicated logic with drift |
| W15 | Low | Prompt and tool inconsistencies |
| W16 | Low | Guardrail stops end with inconsistent statuses |
| W17 | Low | Documentation and contract drift |
| W18 | Low | Discarded `max_tokens` turns stay visible and recorded |
| W19 | Low | CSP allows any script or style from two CDNs |
| W20 | Low | Downgrades keyed on error wording |
| W21 | Low | Cost meter omits failed and aborted streams |
| W22 | Low | Dead code and unused configuration |
| W23 | Low | Smaller UI inconsistencies |
| W24 | Low | The offline basemap draws bands across the map (added after the overhaul) |
| W25 | Low | The legend covers the subject of app-set views (added after the overhaul) |
| W26 | Low–medium | A decision is not tied to the set of options it was taken on (added after the review of the overhaul) |
| W27 | Low–medium | Drafts are not tied to the approved option (added after the review of the overhaul) |
| W28 | Low | The summary's outcome is chosen freely (added after the review of the overhaul) |
| W29 | Low | A retried response can leave its text on screen (added after the review of the overhaul) |
| W30 | Low | Keyboard focus is lost after a decision (added after the review of the overhaul) |
| W31 | Low | Abort leaves open-data requests running (added after the review of the overhaul) |
| W32 | Low | The key field works inside another site's frame (added after the review of the overhaul) |

**W1 (High). Storage keys are not namespaced per app, and two bypass the central config.**

- *Evidence:* `STORAGE` defines `nav.anthropic.key`, `nav.diag`, `nav.model`, `nav.speed` and `nav.introSeen` (`js/config.js:113-119`), but `js/kpi.js:9` uses `nav.sessionCostEur` and `js/console.js:28` uses `nav.consoleText` directly; the key is read and written at `js/keystore.js:12` and `:25`. GitHub Pages serves all of a user's project repositories from one origin (`https://<user>.github.io`), and storage is scoped by origin, not path.
- *Impact:* a sister app on the same account built from this code shares the API key in the same tab (one app's Forget key or 401 handler removes it for the other), suppresses the other's first-visit intro, mixes both apps' spend in "Session cost" and shares the geo failure memory. Any page of that origin opened in the same tab, or a duplicated tab, can read the key, and Navigator's CSP does not protect those pages. "Kept in this tab's session storage only" (`README.md:119`) is accurate but implies more isolation than the origin provides, and the privacy self-test does not look at it.
- *Recommendation:* build every key through one helper (`storageKey(name)` returning `"<app-id>:<name>"`), move the two stray keys into `STORAGE`, import it in the tests and clean up old `nav.*` keys. Host each prototype on its own origin (custom subdomain, a separate GitHub organisation, or Cloudflare Pages) if it stores a key, or keep the key in memory only; state the shared-origin caveat in the key dialog and the privacy row.

**W2 (Medium). "Every euro figure comes from the engine" is claimed for text the model writes freely.**

- *Evidence:* the AI label on the management summary says "Every euro figure, stop day and date comes from the deterministic impact engine, not from the model" (`js/ai_label.js:16`, `:33-36`). The live summary, including the cost table the prompt requests, is model-written Markdown that `ui_final_report` only trims and footers (`js/prompt.js:67`; `js/tools.js:553-563`); drafts and narration are also free text (`js/tools.js:517-532`). `README.md:13` says the agent "cannot invent a number"; the Q&A says "the code rejects anything else" (`DEMO_SCRIPT.md:133`).
- *Impact:* a transcription error or invented figure in the board-ready summary would sit under a label telling the viewer it came from the engine, which is the claim the whole demo rests on.
- *Recommendation:* generate the summary's figure table in code from the approved option and baseline (as the footer is) and let the model write prose only, or extract € amounts and day counts from summary and drafts and flag any value absent from the run's engine or ERP results. Until then, soften the label to "Figures quoted are taken from the engine results; check them against the option cards".

**W3 (Medium). "Verified" means two strings, not two independent sources.**

- *Evidence:* `ui_report_alert` accepts `basis: "verified"` when `sources.length >= 2` after keeping entries with a title or URL (`js/tools.js:403-406`); the script checker counts the same way (`js/sim_check.js:137`). Nothing checks that the two are distinct, independent or seen in this run. `DESIGN.md:109` says "two independent sources, enforced in code"; `README.md:48` says "needs two sources".
- *Impact:* the model can cite one article twice, or a remembered headline, and raise a verified alert, so the headline guardrail is weaker than presented.
- *Recommendation:* dedupe by host; require two successful evidence results earlier in the run (web-search results or successful `geo_*` results, which `js/run_facts.js:39-42` already counts); require cited URLs to appear among the run's search results, or a source to name a successful `geo_*` call; state the precise rule in `DESIGN.md`.

**W4 (Medium). One geo failure disables that data source for the rest of the tab session.**

- *Evidence:* `getJson` records `fail` for any non-OK status, timeout, JSON error or network error (`js/geo.js:20-30`), and later calls skip on `isKnownFailed` (`js/geo.js:13-15`; `js/diagnostics.js:43-46`). The station is model-supplied (`js/tools.js:132-135`) and only sanitised, so an unknown name such as "COLOGNE" returns 404 and poisons PEGELONLINE for KAUB too (`js/geo.js:199-206`). The skip message says the source "failed the Diagnostics check" (`js/geo.js:14`) even when Diagnostics never ran.
- *Impact:* the demo script asks for a live rehearsal in the tab that stays open for the show (`DEMO_SCRIPT.md:18`); one timeout or model typo in rehearsal silently removes the Kaub gauge, the moment the live story is built on (`DEMO_SCRIPT.md:63`).
- *Recommendation:* remember only network/CORS failures and 5xx from probes; treat a 4xx caused by tool input as a tool error without memory; expire failures after a few minutes or retry once before skipping; word the message by origin ("failed earlier in this session"); move the memory into its own module so tools stop importing Diagnostics (`js/geo.js:8`).

**W5 (Medium). Simulation booking drafts lack the AI footer that every live draft carries.**

- *Evidence:* the live tool appends the footer to every draft type (`js/tools.js:526`); the player emits the scripted body unchanged (`js/simulation.js:354-360`); the checker exempts bookings (`js/sim_check.js:199`). 8 of the 53 drafts in `data/sim_runs.js`, all bookings, have the mock line but not "Requires human approval before sending" (for example `data/sim_runs.js:124-126`).
- *Impact:* the stage script says "Every draft carries the AI footer" (`DEMO_SCRIPT.md:80`); in the recommended fallback, Simulation, that is false for bookings, and the two producers disagree on a disclosure line.
- *Recommendation:* finalise drafts through one shared function used by both producers (footer and mock line added in code), and drop the booking exemption.

**W6 (Medium). Live open-data results read only "Result received".**

- *Evidence:* `summarizeToolResult` has no `geo_*` cases and falls back to "Result received" (`js/summaries.js:39-41`), which the live executor uses (`js/tools.js:375`). Simulation steps carry authored summaries such as the Kaub reading (`js/simulation.js:244-247`); recordings inherit the generic text (`js/recorder.js:173`).
- *Impact:* the live gauge reading, quake list or weather flags only show after expanding the JSON, so the live run is less legible than its replay just when the presenter says "real data, right now".
- *Recommendation:* add summaries such as "Kaub 15 cm, falling; about 2 % of barge capacity" or "2 quakes ≥ 4.5 within 300 km, strongest M5.1 near Hualien", plus a test that geo results never use the fallback text.

**W7 (Medium). The engine has no golden-value tests and nothing runs in CI.**

- *Evidence:* the only engine assertion is "value at risk > 0 with 3 options" per reference case (`js/world_check.js:129-140`); the browser suites read figures through placeholders and pass whatever the engine returns; no test calls `simulateImpact` directly; there is no `.github/` workflow.
- *Impact:* the central claim, a deterministic engine computing every euro, has no regression protection; a change in `js/impact.js` could shift every figure while all suites pass.
- *Recommendation:* add a Node snapshot test per reference case (value at risk, first stop day and plant, each variant's cost, residual and total) with an explicit update command, unit cases per mitigation type (ramp-up limits, the air-freight safety-stock rule, reroute cost), and a GitHub Actions workflow for the Node-only suites on every push, with Playwright optional.

**W8 (Medium, accessibility). Streaming narration is re-rendered inside the `aria-live` log.**

- *Evidence:* the log is `role="log" aria-live="polite" aria-relevant="additions"` (`js/console.js:48`); every narration event, partial ones included (45 ms throttle live, small word chunks in Simulation), clears the entry body and appends new paragraph nodes (`js/console.js:150-162`; `js/agent.js:247`; `js/simulation.js:191-198`).
- *Impact:* each re-render adds nodes to the live region, so screen readers are likely to announce growing partial paragraphs again and again, in an app that positions itself against WCAG 2.2.
- *Recommendation:* set `aria-busy="true"` on streaming entries and clear it on `done`, or stream into a node outside the live region and insert only the final paragraph; add axe-core to the Playwright suites and a manual screen-reader pass.

**W9 (Low–medium). The palette checks do not match the role mapping, and two pairs in use fall short.**

- *Evidence:* the checker treats the app background as `ink-2` (`tools/palette.mjs:158`, `:160`), as does the DTCG role `surface` (`:252`), but `--porcelain` is `ink-3` (`css/style.css:20`). Faint text (`ink-10`, `css/style.css:29`) on porcelain measures 4.44:1, below 4.5, for example the do-nothing card's "Not selected" status (`css/drawer.css:70`; `css/components.css:172`; `js/options_panel.js:99-100`). The map-fill check uses `danger-6` (`tools/palette.mjs:175`) while `--affected-fill` is `danger-7` (`css/style.css:42`, `:49`); it still passes (3.40 instead of 3.95). The amber "remaining exposure" bar (`warning-9`) on its `porcelain-2` track measures 2.78:1 (`css/drawer.css:108`, `:111`), against the comment that every bar reaches 3:1 (`css/drawer.css:101-102`).
- *Recommendation:* make the checker read the role mapping (or generate the roles), add "faint text on app background" and "cost bars on track", darken the amber bar to `warning-10` or give it a `warning-11` edge, and align DTCG role names with the CSS ones.

**W10 (Low–medium). "New run" wipes the finished run before the mode is confirmed.**

- *Evidence:* `start()` resets a finished workspace before the mode dialog (`js/ui.js:157`); cancelling returns with console, options, outbox and audit cleared, although `begin()` resets anyway (`js/ui.js:191`). The audit exists only in memory (`js/audit.js:13-17`).
- *Impact:* an unexported audit trail, the app's record-keeping evidence, is lost by an exploratory click.
- *Recommendation:* remove the early reset; optionally offer to export an unexported audit first.

**W11 (Low–medium, accessibility). Map entities are mouse-only and far below the 40 px target claim.**

- *Evidence:* corridors, nodes and suppliers are vector layers with popovers and no keyboard access (`js/map.js:163-169`, `:190-199`, `:223-228`); orders use `keyboard: false` (`:208-209`); only plants are focusable (`:246-247`). Supplier radii are 5–7 px, nodes 3.5–5 px, order blocks 11×7 px (`js/map.js:189-191`, `:222`; `css/map.css:88-93`). `DESIGN.md:123` says every interactive element is at least 40 × 40 px; the test only inspects HTML controls (`tests/layout.mjs:85`).
- *Recommendation:* add larger invisible hit areas, a keyboard-reachable list of marked entities that opens the same popovers, and scope the 40 px claim to HTML controls.

**W12 (Low). `kpi_update.series` is computed and emitted but never used.**

- *Evidence:* the engine builds daily plant-output series for the baseline and each variant (`js/impact.js:661-671`); both producers emit them (`js/tools.js:395`; `js/simulation.js:285`); the KPI handler never reads them (`js/kpi.js:110-127`), nor does any other view.
- *Recommendation:* render them (a plant-output sparkline in the first-stop tile or per option) or stop emitting them; today they only enlarge the audit export.

**W13 (Low). Hard-coded ids and magic numbers sit in otherwise generic modules.**

- *Evidence:* the engine's assumptions text reads `model.plants.get("PL-LEJ")` and `"PL-GYR"` and throws if either is absent (`js/impact.js:62`); the private 60-day look-ahead (`js/impact.js:15`) is repeated as `search_days: 60` (`js/tools.js:393`; `js/simulation.js:284`), "within 60 days" (`js/summaries.js:36`) and a fallback (`js/kpi.js:120`); the 77 cm Kaub reference is typed and its note parsed by splitting on brackets (`js/geo.js:225-226`); node labels, drawable alternatives and `N-CPT` are fixed in the map (`js/map.js:43-51`, `:188`); the footprint node list is fixed (`js/erp.js:47`); probes pick Haiku by array index and literal id (`js/anthropic.js:100`, `:116`; `js/diagnostics_view.js:102`).
- *Recommendation:* export the look-ahead from the engine and return it in results, read plant costs generically, move display ids into the world data, and mark the probe model with a role in `MODELS`.

**W14 (Low). Logic is duplicated, and some copies have drifted.**

- *Evidence:* ERP dispatch exists three times (`js/tools.js:332-338`; `js/simulation.js:22-30`, exported but never imported; `js/sim_check.js:16-24`); the known-id check twice (`js/tools.js:432-436`; `js/sim_check.js:59-60`); the paragraph-split regex twice (`js/console.js:325`; `js/run_facts.js:34`), with label sets that differ ("Unverified:" is styled as a check but not counted; `js/console.js:17-25` against `js/run_facts.js:5-6`); `waitUntil`/`takeDecision` twice (`js/agent.js:342-366`; `js/simulation.js:107-133`); status-to-state mapping three times (`js/agent.js:373`; `js/simulation.js:81`; `js/ui.js:138`); a Haiku cost estimate beside `cost.js` that ignores cache tokens and hard-codes the search price (`js/diagnostics_view.js:101-106`); the CSP host list in `index.html:8`, `js/diagnostics.js:24` and `js/config.js:56-79`.
- *Recommendation:* one tool registry (name, schema, executor, summary, order-free flag) shared by agent, player and checker; one labels module; one decision-queue helper; one status mapping; `usageCostUsd` in Diagnostics.

**W15 (Low). Prompt and tool definitions disagree.**

- *Evidence:* with web search off, the prompt still says "use web_search instead" and "at most 5 web searches" (`js/prompt.js:41`, `:61`; only `:26` is conditional), and geo tools still return `fallback_hint: "use web_search"` (`js/geo.js:10`, `:36-38`). `ui_propose_options` does not check that `recommended_variant_id` is one of the options (`js/tools.js:466`), whereas the script checker does (`js/sim_check.js:168`); a wrong id leaves no card recommended.
- *Recommendation:* generate the fallback sentence and hint from the run's web-search state, and reject an unknown recommendation with the valid ids.

**W16 (Low). Guardrail stops end with inconsistent statuses.**

- *Evidence:* the budget cap ends as `aborted`, like a user Abort (`js/agent.js:104-107`); the step cap as `error` (`:87-89`); exhausted nudges as `incomplete`, shown Stopped (`:151-155`). Run facts are computed only for done, no-findings and incomplete runs (`js/console.js:288`), so a budget stop has none.
- *Recommendation:* end both caps as `incomplete` with a machine-readable reason (`budget_cap`, `step_cap`) and keep `aborted` for the user.

**W17 (Low). Documentation and the event contract have drifted.**

- *Evidence:* `js/config.js:45` cites "TECH_NOTES §7" for guardrails that are in §8; `TECH_NOTES.md:178` calls the PEGELONLINE UUID a fallback, but `stationUuid` is unused (`js/config.js:76`); the contract (`js/events.js:7-25`) omits `alert.basis`, `report.outcome`, the `run_start` fields `model_label`, `sim_source`, `recorded_on` and `recorded_model`, and `map_update.fit`/`focus`/`source`, yet lists a `kpi_update.first_stop_date` nobody emits; `README.md:46` says only badge, watermark and audit differ by mode (see 2.8); `TECH_NOTES.md:288` says the agent "must call ui_await_approvals first", but the code only checks for pending drafts (`js/tools.js:554-555`); simulated tool inputs differ from the live schemas (`js/simulation.js:316`, `:179`).
- *Recommendation:* turn the contract into typedefs or a small schema validated against every emitted payload in the live and simulation suites; fix the references; emit simulated inputs in the live shape.

**W18 (Low). Narration from a discarded `max_tokens` turn stays visible and is recorded.**

- *Evidence:* the discarded turn has already streamed under step-keyed message ids (`js/agent.js:249`, `:253`); the retry uses the next step, so both versions appear (`:110-116`) and the recorder keeps both (`js/recorder.js:114-127`). `tests/live.mjs:174-183` scripts exactly this case.
- *Recommendation:* retract that step's narration when the turn is discarded, or reuse its message ids for the retry.

**W19 (Low). The CSP allows any script or style from two public CDNs.**

- *Evidence:* `script-src` and `style-src` allow `https://unpkg.com` and `https://cdn.jsdelivr.net` wholesale (`index.html:8`). No CSP/code mismatch was found and the suites assert zero violations, but whole-CDN allowances are a known bypass route if an injection point ever appears.
- *Recommendation:* allow only the exact Leaflet file URLs; CSP sources accept paths.

**W20 (Low). Downgrades and the web-search switch depend on error wording.**

- *Evidence:* regexes over the message decide which field to drop (`js/agent.js:201-208`); any 400 mentioning web search counts as "disabled by an admin" (`js/anthropic.js:137-139`), so an invalid web-search parameter would show the wrong banner and disable Live scan.
- *Recommendation:* match the documented wording narrowly, log the matched rule in the audit and unit-test each downgrade.

**W21 (Low). The cost meter omits failed and aborted streams.**

- *Evidence:* cost is added only for completed responses (`js/agent.js:99-100`); a stream that fails or is aborted throws before usage is merged (`js/anthropic.js:282-296`), although its output tokens are billed.
- *Recommendation:* keep the last cumulative usage on the error and add it as an estimate; note the limitation beside the ±25 % acceptance criterion.

**W22 (Low). Dead code and unused configuration.**

- *Evidence:* `pct`, `plural` (`js/format.js:74-80`); `$`, `$$` (`js/dom.js:44-50`); `flowsForPart` (`js/world.js:350-352`); `APP.milestone`, `stationUuid`, `UI.worldView` (`js/config.js:7`, `:76`, `:124`); the map's `onStatus`, `stateOf`, `basemapInfo` (`js/map.js:57`, `:445-446`); `pendingIds`, `statusOf` (`js/outbox.js:113-114`); `hasPending` (`js/options_panel.js:156`); `isOpen`, `active` (`js/drawer.js:73`); `focusStart` (`js/controls.js:112`); `logistics_nodes`, which the scan prompt ignores (`js/erp.js:47-50` against `js/prompt.js:73-84`); the unreachable "(streaming)" branch (`js/audit_panel.js:105`, since `js/audit.js:21` drops partial narration); six unrendered icons (`js/icons.js:14-15`, `:30-31`, `:33`, `:37`).
- *Recommendation:* remove them or use them on purpose (for example `logistics_nodes` in the scan prompt), and add an unused-export lint so the copied shell stays lean.

**W23 (Low). Smaller UI inconsistencies.**

- *Evidence:* the report dialog calls every Simulation summary a "scripted replay", recorded runs included, because only `mode` is passed (`js/ui.js:40`; `js/dialogs.js:184`, `:192`); the intro colours its step numbers red, blue, amber, burgundy and green (`css/modals.css:137-141`), although state colours are "never decoration" (`DESIGN.md:38`) and the rail shows the same steps in ink and burgundy (`css/console.css:50-57`); the drawer's `tablist` has no arrow keys and leaves every tab unselected when closed (`js/drawer.js:15-35`, `:55-63`).
- *Recommendation:* pass `sim_source` to the dialog, colour the intro steps like the rail, and implement the WAI-ARIA tabs pattern or use plain toggle buttons with `aria-expanded`.

**W24 (Low). The offline basemap draws bands across the map.** *Found while building the Rebate Hunter's basemap.*

- *Evidence:* `data/basemap_offline.js` contains two land rings whose longitudes step from +180° to −180° and back (land polygon 48 at 65–69° N, Chukotka; polygon 98 at 16.5° S, Fiji). Leaflet draws each step as a straight edge across the whole map, so the ring fills a band from one side to the other. With tiles blocked, the **Global view** shows a white band at 65–69° N across Scandinavia, the Atlantic and North America.
- *Impact:* exactly when the offline map matters (no tiles: a corporate network, or Simulation offline), the Global view looks broken.
- *Recommendation:* make each ring's longitudes continuous before clipping and cut the ring at ±180° (`tools/build_basemap.mjs` in the Rebate Hunter does this), then rebuild the basemap.

**W25 (Low). The expanded legend covers the subject of views the app sets.** *Found while building the Rebate Hunter's map.*

- *Evidence:* `showWorld()` fits bounds without padding (`js/map.js:277-281`), `fitIds()` flies to bounds without padding (`:424-434`) and `focus()` centres on the requested point (`:408-413`), while the expanded legend overlays the map's lower left, 248 px wide (`css/map.css:123-127`). In the Global view at 1920×1080 the legend covers Leipzig and Győr, the two plants the story is about.
- *Impact:* the presenter clicks Global view and the audience loses the plants; scenarios focused far west would hide their subject entirely.
- *Recommendation:* measure the expanded legend and pass it as `paddingTopLeft` to `fitBounds`/`flyToBounds`, and offset `focus()` by half its width (`legendInset()` in the Rebate Hunter's `js/map.js`).

W26 to W32 were found when three independent review agents checked the finished Rebate Hunter. Its code came from the Navigator, so each was checked again in the Navigator's code; the references below are the Navigator's.

**W26 (Low–medium). A decision is not tied to the set of options it was taken on.**

- *Evidence:* `ui_propose_options` can be called again at any time, after an approval included (`js/tools.js:445-479`; only `awaitDecision` checks `run.approvedOption`, `:484`). `waitForDecision` takes any queued decision (`ctx.takeOptionDecision(() => true)`, `:490`), and every set uses the ids V1 to V3. The options panel applies any `option_decision` to the cards on screen (`js/options_panel.js:126-135`).
- *Impact:* a click on option B of a set the agent has just replaced counts as approving option B of the new set, which can be a different response at a different cost; a new set after an approval leaves the first approval standing beside fresh cards.
- *Recommendation:* number each set (`options_seq` on `options` and `option_decision`), ignore decisions on an older set in the tool and in the panel, and refuse new options after an approval.

**W27 (Low–medium). Drafts are not tied to the approved option.**

- *Evidence:* `ui_draft_action` checks only that some option was approved (`js/tools.js:523`). After "Accept the risk", the tool result tells the model not to contact suppliers (`:499-500`), but nothing stops an email to a supplier or a booking.
- *Impact:* the human accepts the risk and the outbox still fills with supplier emails and bookings for a response nobody chose; the approval gate catches it only if the approver notices.
- *Recommendation:* derive the allowed draft types from the approved option's mitigation types (only the re-plan note after "Accept the risk") and refuse the rest with the reason.

**W28 (Low). The summary's outcome is chosen freely.**

- *Evidence:* `ui_final_report` accepts any of the four outcomes the model names (`js/tools.js:561`), whatever was decided.
- *Impact:* a run can end "response decided" without a decision, or "risk accepted" after option A was approved; the run-end line, the run facts and the audit export carry the model's word.
- *Recommendation:* derive the outcome from the decision (approved option, accepted risk, no options shown) and refuse a contradicting one.

**W29 (Low). A retried response can leave its text on screen.**

- *Evidence:* message ids depend on the step and block index only (`js/agent.js:249-250`), and a response that breaks off is retried with the same stream hooks (`:174-191`). The retry overwrites the broken response only where its blocks line up; a text block the retry does not repeat stays in the console and in a recording. W18 is the same problem for the `max_tokens` retry.
- *Recommendation:* give every attempt its own ids and emit an event that marks a discarded attempt's entries, so the console can grey them and the recorder can drop them.

**W30 (Low, accessibility). Keyboard focus is lost after a decision.**

- *Evidence:* the Options and Outbox panels rebuild themselves after every decision (`js/options_panel.js:126-135` and `js/outbox.js:89`, both through `render()`, which clears the panel at `:25` and `:24`). The focused button disappears and focus falls back to the page.
- *Impact:* a keyboard or screen-reader user who approves the first of four drafts has to tab back through the whole page to reach the second.
- *Recommendation:* after a rebuild that followed a decision in the panel, focus the next pending button, or the panel itself.

**W31 (Low). Abort leaves open-data requests running.**

- *Evidence:* `getJson` uses its own controller for the ten-second timeout only (`js/geo.js:16-17`); Abort ends the run at once (`js/agent.js:406-414`) but cannot reach the request, which runs on and still writes its result into the failure memory (`js/geo.js:20-30`).
- *Recommendation:* pass the run's abort signal to every open-data request and never remember an aborted request as a failure.

**W32 (Low). The key field works inside another site's frame.**

- *Evidence:* a meta CSP cannot set `frame-ancestors`, so any site can frame the app, and the key dialog (`js/dialogs.js:64-69`) works there as anywhere; the field relies on `autocomplete="off"`, which browsers' password managers commonly ignore for password fields.
- *Impact:* a framing page can dress the dialog in its own context (clickjacking); the key can end up in a password manager, outside the tab session the privacy notes promise.
- *Recommendation:* refuse key entry when `window.top !== window.self` (Simulation can stay), and add the password-manager opt-outs (`data-1p-ignore`, `data-lpignore`, `data-bwignore`, `data-form-type="other"`).

---

### 8. Reusable patterns for the Rebate Hunter

The sister prototype changes the domain (vendor-account consolidation by deterministic entity resolution, spend aggregated against rebate tiers, unclaimed rebates, claim letters) but tells the same story: an agent gathers evidence with tools, a deterministic engine owns every euro, three costed options sit beside doing nothing, drafts wait for approval, and a labelled Simulation replays the run. Most of Navigator transfers as a shell.

#### 8.1 Domain-neutral shell (copy nearly unchanged)

| Module | Why it transfers |
|---|---|
| `js/events.js` | A generic bus and envelope; at most rename `RUN_STATES` labels |
| `js/state.js` | Generic store; change the persisted keys (W1) |
| `js/anthropic.js`, `js/sse.js` | A complete browser streaming client with retries, timeouts and probes; parameterise the probe model (W13) |
| `js/cost.js` | Price-table maths keyed by model id |
| `js/keystore.js` | Session-only key with masking and redaction; namespace it (W1) |
| `js/agent.js` | The loop, downgrades, caps, nudges and abort hygiene are domain-free; make `ORDER_FREE`, `phaseForTool` and nudge texts configurable |
| `js/audit.js`, `js/audit_panel.js` | Redacted event and exchange audit; only the company note and `world_version` are domain copy |
| `js/run_facts.js` | Per-run acceptance facts; configure tool kinds and labels |
| `js/recorder.js`, `js/simulation.js`, `js/sim_check.js`, `js/sim_vars.js` | Recording, playing, branch checking and placeholder filling are generic once the tool registry is shared (W14); the variable set and evidence kinds are not |
| `js/payoff.js` | "Option figures, baseline, decision effects" is the right abstraction; field names change (recoverable amount rather than exposure) |
| `js/console.js`, `js/progress.js`, `js/handover.js`, `js/ai_label.js` | The logbook, labelled reasoning, rail and hand-over grammar are the heart of the agentic UX; move step labels and copy to config |
| `js/options_panel.js`, `js/outbox.js`, `js/drawer.js` | Three-plus-baseline decisions with comparison bars and draft approval fit claim strategies and claim letters; rename figures and draft types |
| `js/controls.js`, `js/dialogs.js`, `js/modal.js`, `js/intro.js` | Generic controls and dialogs; copy changes only |
| `js/diagnostics.js`, `js/diagnostics_view.js` | The self-test runner and privacy row transfer; the test list becomes configuration; split out the failure memory (W4) |
| `js/main.js`, `js/libs.js`, `js/dom.js`, `js/icons.js`, `js/format.js`, `js/md.js` | Boot, SRI loader, safe DOM and Markdown, formatting |
| `css/tokens.css`, `css/style.css`, `css/components.css`, `css/console.css`, `css/drawer.css`, `css/modals.css`, `css/fonts.css`, `design/tokens.json` | Token pipeline, roles and components carry over; regenerate from a new source colour if the brand differs |
| `tools/palette.mjs` | Change `SOURCE` and the pairs after fixing the role drift (W9) |
| `tests/lib/harness.mjs`, `tests/lib/fake-claude.mjs`, `tests/run-all.mjs`, `tests/unit.mjs` | Harness, protocol validator and client tests are generic; drop the "Nordwerk" and tool-count checks |
| `tests/accept.mjs`, `tests/layout.mjs`, `tests/design.mjs`, `tests/smoke.mjs` | The patterns (key lifecycle, Abort/Reset matrix, offline replay, viewports, targets, grammar) transfer; selectors and fixtures change |
| `index.html` | Skeleton, CSP pattern and boot screen; change hosts and data scripts |

#### 8.2 Domain-specific (rewrite)

| Module | Why it must be rewritten |
|---|---|
| `data/world.js` | Plants, parts and routes become vendor accounts, parent-linkage knowledge, contracts with tier clauses, invoices and spend |
| `data/scenarios.js`, `data/reference_cases.js`, `data/sim_runs.js` | Seeds, engine specs and authored scripts describe disruptions |
| `data/basemap_offline.js` | Only needed if the new app keeps a map |
| `js/world.js` | Supply-graph building and route geometry are specific; keep the "indexed model from window data" pattern |
| `js/impact.js` | Replace with a deterministic rebate engine (tier thresholds, retroactive and growth rebates, claimable amount per consolidated vendor) that keeps the contract: validated inputs, field-level errors, variants costed against a baseline |
| `js/erp.js` | Becomes vendor, contract, invoice and entity-resolution queries |
| `js/geo.js` | Weather and river tools do not apply; replacements (exchange rates, company registers) keep the `{error, fallback_hint}` contract |
| `js/tools.js` | Keep the guardrail patterns (engine-filled figures, drafts after approval, report after decisions, footers in code); the schemas are new |
| `js/prompt.js`, `js/summaries.js` | New mission, rules, modelling guide, report format and tool summaries |
| `js/kpi.js` | New tiles (unclaimed rebates, consolidated vendors, claim deadline, session cost); keep the decision-payoff mechanism |
| `js/map.js`, `js/popovers.js`, `css/map.css` | Geography may be the wrong canvas; a consolidation or spend view replaces it, and series data like `kpi_update.series` could finally drive a chart (W12) |
| `js/world_check.js`, `tools/check_world.mjs` | Integrity checks encode Navigator's data spec; write equivalents for the rebate world |
| `tests/sims.mjs`, `tests/live.mjs` | Plans and scripted conversations are domain fixtures; the case structure stays |
| `js/config.js` | Split into a generic part (API, models, caps, storage, libraries) and an app part (endpoints, defaults, copy) |
| `README.md`, `DESIGN.md`, `TECH_NOTES.md`, `DATA_SOURCES.md`, `DEMO_SCRIPT.md`, `tests/README.md`, `favicon.svg` | Structure and rigour are worth copying; content and logo are Navigator's |

#### 8.3 Fix before copying

1. Namespace every storage key through one helper and plan one origin per prototype (W1).
2. Introduce one tool registry shared by agent, player and checker (W14) and a typed, test-validated event contract (W17).
3. Make "numbers from the engine" true for summaries and drafts through code-generated tables or a numeric post-check (W2), and make the two-source rule check provenance and independence (W3). For the Rebate Hunter the natural pair is "a contract clause and a ledger total" behind every verified finding.
4. Share draft finalisation between producers so disclosure lines cannot diverge (W5), and give every tool a meaningful console summary (W6).
5. Add engine snapshot tests and a CI workflow from the first commit (W7).
6. Fix live-region streaming, the palette and role drift, and map keyboard access in the shell (W8, W9, W11), so the sister app inherits the fixes rather than the gaps.

---

## Part 2. The Rebate Hunter before the overhaul (Streamlit version 6.2)

**Subject:** `app.py` (883 lines) and `requirements.txt` on `main` before this change (commit `9f564f5`), deployed on Streamlit Community Cloud at `prockickbackhunter.streamlit.app`. The file is preserved unchanged on the branch `legacy-streamlit`.

### What it was

- **One Python file, one screen.** Streamlit, pandas and plotly; German plain-language copy ("einfache Sprache"); a dark Apple-style theme injected as CSS; a responsive layer for phones.
- **Six "agents" as functions.** A process token (one dict) passes through `agent_ingestion` (marked SIMULATED: loads the synthetic tables), `agent_resolution` (LIVE: clusters accounts), `agent_contract` (SIMULATED: a fixed rule, €50m and 2 %), `agent_finance` (LIVE: sums the cluster and compares it with the threshold), a human review (one approve/reject with a mandatory reason code) and `agent_booking` (SIMULATED: a fake accounting document number and a CFO email draft). There is no language model and no tool use: the "GenAI processing time" between stages is `time.sleep(0.7)`, labelled as simulated.
- **Synthetic SAP tables.** 150 vendors (LFA1-style: 9 storyline accounts, 141 noise accounts) and 1,203 purchase orders (EKKO-style), generated in memory with Python's `random`, seed 1337, then shuffled with pandas.
- **Entity resolution with discipline.** A hand-written parent knowledge base (`PARENT_KB`, nine entries) is the only merge authority; an entry counts as verified if its identifier starts with `529900`. Similar names and cities never merge. The Apex look-alike pair (66.7 % `difflib` similarity, different owners) is refused; Cisco and Meraki (23.1 %) are merged because the register says so.
- **Measured quality.** Pairwise precision and recall against hand-labelled ground truth, computed at run time (100 %, 100 %, 0 false merges).
- **Three targets.** Cisco (five accounts, €52.40M → €1,048,000), Microsoft (two accounts, €47.00M, an honest "no claim") and Apex (single account).
- **Record-keeping.** An append-only audit list in the session with a CSV download.

### Strengths worth keeping

1. The business story is sharp and quantified: fragmentation hides a threshold crossing; the showcase number is exact and reproducible.
2. The merge discipline (register over names) and the Apex counter-example are the right lesson, and the similarity figures make it tangible.
3. Honest labelling of what is real logic and what is stubbed.
4. Deterministic data and figures, identical in every run.

### Gaps against the Navigator

| Area | Navigator 1.1.0 | Rebate Hunter 6.2 |
|---|---|---|
| Agent | Live Claude tool-use loop, streamed, with thinking summaries, retries and caps | None: Python functions with simulated delays |
| Modes | Simulation (scripted replay) and Live (own key), labelled everywhere | One mode; every stage "live" or "simulated" by design |
| Evidence | Live web search and open data, two-source verification | A static dictionary; no external check |
| Quantification | Deterministic engine with three costed options against doing nothing | One sum against one threshold; no options, no costs, no deadlines |
| Time | Days to the first line stop drive urgency | No agreement years, no claim windows, no "by when" |
| Human oversight | Option decision plus approval of each draft; nothing sent | One approve/reject with a reason code; a simulated posting |
| Interface | Map, console, KPI tiles, drawer, progress rail, AI labels; English | One Streamlit page; German |
| Design system | Generated OKLCH palette with 45 checks; WCAG 2.2 | Hand-written dark CSS; no checks |
| Hosting | Static files on GitHub Pages; no server | Streamlit server (cold starts) |
| Audit | JSON export of every event and model exchange, redacted | CSV of stage events |
| Tests | Nine suites incl. protocol-checking fake API | None |
| Data realism | Real geography and precedents | Real group names; identifiers such as `529900CISCO0001` are illustrative (15 characters; real LEIs have 20 with check digits) |

---

## Part 3. What the overhaul did

The Rebate Hunter was rebuilt on the Navigator's shell and design system and given the rebate domain the Streamlit version only sketched.

**Kept from the Streamlit version:** the business story, the register-only merge rule, the Apex counter-example, the 150 accounts and 1,203 orders bit for bit (a JavaScript port of Python's Mersenne Twister and the generator, checked against a Python fingerprint), and the headline figures (Cisco €52.4M → €1,048,000; Microsoft €47.0M below the threshold).

**Taken from the Navigator:** the static no-build app, the run-event bus with two producers (live agent and simulation player), the streaming client and agent loop with every protocol rule, the guardrails pattern, the mode dialog and key handling, Diagnostics, the recorder, the run facts, the audit export, the console, KPI tiles, drawer, options, outbox, progress rail, hand-over labels, AI labels, intro window, the map framework, the full design system and the test battery.

**Built new for the domain:**
- A synthetic company with three company codes, a vendor master with group keys, a ledger, a subscription register of real groups (real legal entities, LEIs and acquisition dates), eight agreements with clauses, and year-end report rules (`tools/build_world.mjs`).
- A deterministic rebate engine (`js/rebate.js`): retroactive tiers, contract exchange rates, supplier statements, report blind spots, agreement years and claim deadlines, and five response actions (claim, set-off, recovery-audit firm, link accounts, fix the report) costed against doing nothing.
- ERP tools for agreements, vendors, spend, duplicates, the register and the report; open-data tools for GLEIF, Wikidata and ECB rates; a Python-exact `difflib` port.
- Six scenarios on real corporate facts, each with a scripted replay, and the Live sweep.
- Fixes of the Navigator's weaknesses where the shared code allowed (Part 5).

**Hardened after an independent review.** Three review agents that had not taken part in the build checked the result: one for parity and usability, one for security, the live agent and the tests, one for domain correctness and facts. Everything they found was fixed before delivery (`TECH_NOTES.md` D-R32 to D-R41):
- **One guardrail policy for both producers** (`js/guards.js`). The live tools and the simulation checker apply the same rules, so a scripted or recorded replay cannot do what a live run may not.
- **Decisions, drafts and the summary bound together.** A decision belongs to the set of options it was taken on; drafts can only be of the kinds the approved option contains (a posting needs a set-off); the summary's outcome follows the decision (W26 to W28).
- **"Verified" means checked in this run.** A verified alert needs the register plus an independent confirmation (GLEIF parent, Wikidata owner or a web search) for every account outside the agreement, and the alert lists what was checked. A response that breaks off and is retried is marked "Discarded", and its web searches do not count (W29).
- **A stricter figure audit.** English and German number formats, the currency of each amount, a rounding tolerance capped at 2 %, and a scope per text: alerts, option cards, drafts and the summary may quote only the figures they rest on. If the model insists after two refusals, the amounts are shown as unchecked.
- **Domain corrections.** Set-off settles after a seven-day objection period; a count that leaves linked accounts out is labelled partial; dates carry the year when it is not the current one; a recorded replay runs on its recording day; the running year's projected share of the headline is shown.
- **Usability and safety details.** The header keeps two rows down to 1280 px in every state; the legend no longer covers what a view focuses on; keyboard focus stays in the Options and Outbox panels after a decision (W30); Abort cancels open-data requests in flight (W31); the key field refuses to work inside another site's frame and asks password managers not to save it (W32).

---

## Part 4. Parity checklist

Status: **Same** — identical code or behaviour (shared stylesheets and shell modules are byte-for-byte equal apart from names and comments); **Adapted** — the same feature with rebate content; **Improved** — the same feature plus a fix that can be ported back; **Replaced** — a domain module in the same role; **New**; **Changed** — deliberately different.

### Look

| # | Navigator feature | Rebate Hunter counterpart | Status |
|---|---|---|---|
| P1 | Palette generated from `#7a1e3a` in OKLCH, 12-step scales, roles | Same generator and source; all 96 token values identical; `tools/palette.mjs --check` 45/45 | Same |
| P2 | Barlow, Barlow Semi Condensed, IBM Plex Mono, self-hosted | Same files and `@font-face` rules | Same |
| P3 | Layout: header (brand, badges, four KPI tiles), control bar, map 60 % / console 40 %, drawer (Options, Outbox, Audit) | Same grid, sizes and breakpoints | Same |
| P4 | Components: buttons, chips, KPI tiles, option cards, comparison bars, outbox cards, AI label, progress rail, status pill, legend, modals, console entries | `css/style.css`, `components.css`, `console.css`, `drawer.css`, `modals.css`, `fonts.css` identical | Same |
| P5 | Colour grammar: burgundy = human, violet = AI, red/amber/green = network, blue = checking, hazard = simulation | Same rules; red/amber/green mean rebate positions | Adapted |
| P6 | Logo and favicon (burgundy tile, white mark) | Own mark: three accounts converging into one group ring, same tile, colours and sizes | Adapted |
| P7 | Boot screen, `file://` help, missing-file report | Same | Same |
| P8 | Motion and reduced motion | Same | Same |
| P9 | Accessibility: skip link, live regions, modal focus trap, keyboard dropdowns, 40 px targets, focus ring | Same, plus `aria-busy` on streaming entries | Improved (W8) |
| P10 | Projector features: Larger text, washout and colour-blind review, five viewports | Same | Same |
| P11 | Map: OSM tiles desaturated, CARTO optional, offline basemap, legend with toggles, two view buttons, popovers, state styling and flash, view kept on resize | Vendor accounts by spend band, group headquarters with labels, register links (dashed when acquired), billing links, company codes; "Europe view" and "Global view"; legend-aware views, far-zoom glyphs, offline basemap without antimeridian bands, city clusters spread | Adapted, Improved (W24, W25) |

### Run model and features

| # | Navigator feature | Rebate Hunter counterpart | Status |
|---|---|---|---|
| F1 | Mode dialog: Simulation or Live, "Will run", Change or forget key; custom what-ifs block Simulation | Same | Same |
| F2 | Key handling: masked dialog, format check, free `/v1/models` check, session-only storage, redaction everywhere, Forget key, 401 removes the key, workspace spend-limit advice | Same, under the app's own storage name `rh.anthropic.key`; no key entry inside another site's frame; password managers asked not to save the field | Improved (W1, W32) |
| F3 | Model choice: Sonnet 5.5 (default), Haiku 5.5, Opus 5.5 with effort and `max_tokens` | Same | Same |
| F4 | Streaming client: headers, SSE, retries, downgrades, stop reasons, audit records | Same client; every attempt has its own message ids, and an attempt that is not kept (a stream that breaks off and is retried, or a turn dropped by the `max_tokens` retry) is marked in the console and left out of recordings | Improved (W18, W29) |
| F5 | Cost meter (session tile, this run / last run), €3 and 40-call caps | Same | Same |
| F6 | Guardrails in code (16, Navigator §4.6) | All 16, plus register-only merges, contract rules in the engine, two distinct sources and two evidence kinds with an independent confirmation for accounts outside the agreement, a figure audit of alerts, option cards, drafts and summary, recommendation must be an option, what-if and partial results barred from options, a decision bound to its set of options, drafts only of the kinds the approved option contains, the summary's outcome following the decision; one policy for live runs and the script checker (`js/guards.js`) | Improved (W2, W3, W15, W26–W28) |
| F7 | Live scan (no injected scenario; honest empty end) | Live sweep: checks every rebate agreement; stays available without web search | Adapted, Changed (D-R23) |
| F8 | Custom what-if (20–800 characters, Live only) | Same | Same |
| F9 | Six preset scenarios with reference cases (hypothesis and verified case with three variants) | Six rebate scenarios on real corporate facts | Adapted |
| F10 | Simulation scripts with engine placeholders and a static checker | Same format with rebate placeholders; tool inputs in the live shape; the checker applies the live guardrail policy, figure audit included | Adapted, Improved (W17) |
| F11 | Save run as simulation (recorder) | Same; refused tool calls and discarded attempts leave no step; a recording carries the world and engine versions, replays on its recording day and is audited like a live run | Improved (W29) |
| F12 | Run facts on the console's last line and in the export | Same, plus guardrail refusals | Improved |
| F13 | Audit log tab with filters and JSON export | Same | Same |
| F14 | Diagnostics: API, open-data rows, tiles, Leaflet, world integrity, key and privacy, paid web-search probe, version footer | GLEIF, Wikidata and ECB rows; failure memory in its own module (network/5xx only, ten minutes, worded by origin); the privacy row notes other apps' keys on the same origin | Adapted, Improved (W4) |
| F15 | Open-data tools: Open-Meteo, USGS, EONET, PEGELONLINE | GLEIF (entity and ultimate parent), Wikidata (ownership), ECB rates (Frankfurter); Abort cancels requests in flight | Replaced, Improved (W31) |
| F16 | ERP tools: suppliers, BOM, stock, orders, routes, alternatives | Agreements, vendors, spend, duplicate check, register (family tree), year-end report | Replaced |
| F17 | Deterministic impact engine (stop days, line-stop cost, seven mitigations) | Deterministic rebate engine (tiers, deadlines, five response actions) | Replaced |
| F18 | Intro window: five steps, three value points, under 200 words | Same structure, rebate copy | Adapted |
| F19 | Console logbook: labels, struck-through revisions, reasoning, tool lines with summaries, alerts, decisions, report, run-end line, Jump to latest | Same, plus Guardrail lines, the evidence checked for a verified alert, and discarded attempts greyed and marked; every tool has its own summary | Improved (W6, W29) |
| F20 | KPI tiles: Value at risk, First line stop in, Detection → decision, Session cost; payoff after a decision | Rebate at risk, Claim deadline in, Detection → decision, Session cost; same payoff mechanism; a first estimate is muted, a partial count labelled, and the tooltip gives the running year's projected share | Adapted |
| F21 | Hand-over labels: Awaiting your decision / your approval | Same | Same |
| F22 | Progress rail: Spot, Check, Calculate, Propose, Prepare | Same | Same |
| F23 | AI labels on options, drafts and summary | Same; drafts and summary say their amounts were checked | Improved (W2) |
| F24 | Options: three plus do nothing, comparison bars, recommended frame, "Accept the risk" | Same; Response cost, Rebate still lost, Cash in after, Net recovery; "Accept the loss"; the do-nothing card shows the projected part; a decision counts only for the set it was taken on; focus stays in the panel | Adapted, Improved (W26, W30) |
| F25 | Outbox: email and mock booking drafts, footers, Approve all | Email, posting (mock line) and memo drafts; footers from one shared function in both modes; an "Unchecked amounts" chip when the figure audit gave up; focus stays in the panel | Adapted, Improved (W5, W30) |
| F26 | Management summary dialog and download | Same; a recorded replay is named as such | Improved (W23) |
| F27 | Error banners with redaction | Same | Same |
| F28 | Abort and Reset hygiene; "New run" | Same; "New run" no longer wipes the finished run before the mode is chosen | Improved (W10) |
| F29 | Replay speed ×1, ×2, ×4 | Same | Same |
| F30 | Map popovers from ERP queries | Vendor, company code, group and register-link popovers | Adapted |
| F31 | Orders in transit on the map | Not applicable (no logistics); orders appear as ledger data in `erp_get_spend` | Changed |

### Shared shell (identical apart from names and comments)

`js/events.js` (contract comment adapted), `js/anthropic.js`, `js/sse.js`, `js/cost.js`, `js/keystore.js`, `js/dom.js`, `js/md.js`, `js/modal.js`, `js/libs.js`, `js/handover.js`, `js/progress.js`, `js/drawer.js`, and `css/` except `map.css`. Keep these in step in both repositories (`DESIGN.md` §9).

### Tests, tooling and documents

| # | Navigator | Rebate Hunter | Status |
|---|---|---|---|
| T1 | tokens (`tools/palette.mjs --check`) | Same | Same |
| T2 | world (`tools/check_world.mjs`, 32 checks) | 34 checks for the rebate world; the scripts are held to the live guardrail policy | Adapted, Improved |
| T3 | unit | Same | Same |
| T4 | smoke (8 cases) | 8 cases | Adapted |
| T5 | sims (6 scripts, four decision patterns) | Same plans for the rebate scripts | Adapted |
| T6 | live (7 cases against the fake API) | The same seven, with a figure-audit refusal, a GLEIF 404, the source memory and the open-data parsers added, plus an eighth case for the guardrails: broken-off evidence, a register-only verified alert, a stale decision, a posting without set-off, a German-format wrong amount, a contradicting outcome | Adapted, Improved |
| T7 | accept (key, Diagnostics, Abort/Reset, offline) | Same, with GLEIF blocked | Adapted |
| T8 | layout (five viewports, idle and options; touch targets) | Same, plus the outbox state and the other five scenarios at 1280×720 (7 checks) | Adapted, Improved |
| T9 | design | Same | Same |
| T10 | — | engine (19 tests): legacy data vs Python, `difflib` vs Python, golden figures, refusals, the guardrail policy | New (W7) |
| T11 | — | GitHub Actions workflow | New (W7) |
| T12 | `README.md`, `DESIGN.md`, `TECH_NOTES.md`, `DATA_SOURCES.md`, `DEMO_SCRIPT.md`, `tests/README.md` | Same set, rewritten for the rebate domain | Adapted |
| T13 | — | `REVIEW.md` (this file) | New |

---

## Part 5. Back-port recommendations for the Navigator

Findings W1–W32 with what the Rebate Hunter did. "Ported" items can move back into the Navigator mostly as they are.

| ID | Finding | In the Rebate Hunter | Back-port |
|---|---|---|---|
| W1 | Storage keys not namespaced; two outside the config | All keys through `STORAGE` with the `rh.` prefix; tests import them | Keep `nav.` but route `nav.sessionCostEur` and `nav.consoleText` through `STORAGE`; export `KEYS` to the tests |
| W2 | "Every figure from the engine" claimed for free text | Figure audit (`js/figures.js`) on drafts and summary; AI label states it exactly | Port `js/figures.js` and the checks in `tools.js` (`figureCheck`) |
| W3 | Two sources = two strings | Distinct sources plus two evidence kinds from the run (`isEvidence`, `EVIDENCE_KIND`) | Port with geo tools as evidence kinds |
| W4 | One geo failure disables a source for the session | `js/source_health.js`: network/5xx only, ten minutes, worded by origin | Port the module; drop the Diagnostics import in `geo.js` |
| W5 | Simulation bookings lack the AI footer | `js/drafts.js` used by both producers | Port |
| W6 | Live geo results read "Result received" | A summary for every tool | Add `geo_*` summaries |
| W7 | No golden engine tests, no CI | `tests/engine.mjs`, `.github/workflows/tests.yml` | Add an impact-engine golden suite; copy the workflow |
| W8 | Streaming re-rendered inside `aria-live` | `aria-busy` while streaming | Port (two lines in `console.js`) |
| W9 | Palette checks miss two pairs in use | Open in both (palettes kept identical) | Fix in both together |
| W10 | "New run" wipes the run before the mode is chosen | Fixed in `ui.js` | Port |
| W11 | Map entities mouse-only | Open in both | Fix in both together |
| W12 | `kpi_update.series` unused | Not emitted | Stop emitting |
| W13 | Hard-coded ids and magic numbers | Engine constants exported (`DEFAULT_HORIZON_DAYS`, `UI.urgentDays`); a few label placements remain in `map.js` | Partial |
| W14 | Duplicated logic | One ERP tool table, one labels module | Port the pattern |
| W15 | Prompt and tools disagree without web search; recommendation not checked | Both fixed | Port |
| W16 | Guardrail stops end with mixed statuses | Open in both | Decide together |
| W17 | Event contract drift; simulated inputs differ from live | Inputs in the live shape; contract comment updated | Port |
| W18 | Discarded `max_tokens` narration stays visible | Fixed with W29: ids per attempt and an `attempt_discarded` event | Port with W29 |
| W19 | CSP allows both CDNs wholesale | Exact Leaflet file URLs | Port |
| W20 | Downgrades keyed on error wording | Open in both | Decide together |
| W21 | Cost meter omits failed streams | Open in both | Decide together |
| W22 | Dead code | Removed from the app's own modules; the shared shell keeps `$`/`$$` (`dom.js`) and `isOpen`/`active` (`drawer.js`) so it stays identical | Remove in both together |
| W23 | Report dialog calls recordings "scripted"; intro step colours; drawer tabs | Recording named correctly; the other two kept for parity | Port the first; decide the others together |
| W24 | **New.** The offline basemap draws bands across the map: two Natural Earth rings (Chukotka, Fiji) step from +180° to −180°, visible at 65–69° N in the Navigator's Global view without tiles | `tools/build_basemap.mjs` unwraps and cuts such rings | Rebuild the Navigator's basemap with the same step |
| W25 | **New.** In the Global view the expanded legend covers Leipzig and Győr; views the app sets ignore the legend | Focus offset and fit padding by the legend's width (`legendInset` in `map.js`), kept when the legend is collapsed or a layer toggled | Port |
| W26 | **New.** A decision is not tied to the set of options it was taken on | `options_seq` on `options` and `option_decision`; older decisions ignored in tool and panel; no new options after an approval | Port |
| W27 | **New.** Drafts are not tied to the approved option | `draftError` in `js/guards.js`: drafts only of the kinds the approved option contains | Port, with the mitigation types as kinds |
| W28 | **New.** The summary's outcome is chosen freely | `reportOutcome` in `js/guards.js` derives it from the decision and refuses a contradiction | Port |
| W29 | **New.** A retried response can leave its text on screen | Ids per attempt; `attempt_discarded` greys the entries and the recorder drops them | Port (`agent.js`, `console.js`, `recorder.js`) |
| W30 | **New.** Keyboard focus is lost after a decision | Focus moves to the next pending button or the panel | Port (`options_panel.js`, `outbox.js`) |
| W31 | **New.** Abort leaves open-data requests running | The run's signal reaches every request; aborted requests and rate limits are not remembered as failures | Port (`geo.js`, `tools.js`) |
| W32 | **New.** The key field works inside another site's frame | Key entry refused when framed; password-manager opt-outs on the field | Port (`dialogs.js`) |

Two smaller RH additions are also worth taking back: Guardrail lines in the console with a count in the run facts, and the supplier group (here) or plant (Navigator) following the money after a decision.

---

## Part 6. Decisions and open points

**Decisions taken without a reply from the requester** (the brief left them open; each is easy to change):
1. **English interface.** The Streamlit version was German; the Navigator and its documents are English. All copy is English.
2. **Exactly three costed options plus doing nothing**, as in the Navigator, replacing the Streamlit version's single approve/reject gate.
3. **Storage prefix `rh.`**, so both apps can live on the same `github.io` origin without sharing a key, intro flag or failure memory.

**Deployment.** Merging this into `main` removes `app.py`, so the Streamlit app at `prockickbackhunter.streamlit.app` will fail until it is pointed at the branch `legacy-streamlit` (or retired). GitHub Pages for this repository: Settings → Pages → Deploy from a branch → `main` / `(root)`; the site appears at `https://victorpflueger.github.io/PROC-Rebate-Hunter/`.

**Not verified in this build** (no API key and no access to the open-data hosts from the build environment):
- A real live run with a key: timing, cost and the model's actual path. The protocol, guardrails and recorder are covered by the fake-API suite; the run facts and the audit export give the real numbers in rehearsal.
- Browser CORS of GLEIF (undocumented). Diagnostics tests it on the presentation laptop; the agent falls back if it fails.

**Open in both apps:** W9, W11, W16, W20, W21 and part of W23 (Part 5). They touch the shared shell, so they should be fixed in both repositories at once to keep the prototypes identical. W21 matters a little more now that discarded attempts are visible: their tokens are billed but not metered.

**Open in the Rebate Hunter:**
- **The headline includes a projection.** "Rebate at risk" counts the running year's projected rebate, about half of the figure in five of the six scenarios (the Microsoft correction has none). The do-nothing card and the tile's tooltip show that part; whether the headline should leave it out is a business choice.
- **One clause is approximated.** The Microsoft agreement's 15-month look-back is modelled as 456 days; a calendar 15 months can be 457, so the engine is one day conservative (`DATA_SOURCES.md`).
