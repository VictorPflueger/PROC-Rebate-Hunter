# Tests (optional, for developers)

Rebate Hunter itself needs no Node.js, npm or build step. These scripts are the checks behind the acceptance checklist in `TECH_NOTES.md` §12. Run them after changing code or data. GitHub Actions runs them on every push and pull request (`.github/workflows/tests.yml`).

## What runs

| Suite | Command | Checks |
|---|---|---|
| tokens | `node tools/palette.mjs --check` | The colour system: WCAG 2.2 contrast for every text and state pairing, burgundy kept apart from danger, the state colours, cost bars and brand kept apart under simulated protanopia, deuteranopia and tritanopia, and `css/tokens.css` and `design/tokens.json` up to date with the generator. Node.js only |
| world | `node tools/check_world.mjs` | Synthetic world, scenarios, reference cases and the six simulation scripts (34 checks). Node.js only |
| unit | `node tests/unit.mjs` | Streaming client: SSE parsing, thinking signatures, retries, aborts, truncated streams; cost maths per model. Node.js only |
| engine | `node tests/engine.mjs` | The Streamlit version's 150 accounts and 1,203 orders against the fingerprint Python prints (`tools/legacy_reference.py`); the `difflib` port against Python's ratios; golden figures of the rebate engine for all six scenarios; the engine's refusals (non-register merges, forbidden set-off, running-year claims, claims faster than their preparation); duplicate check, evidence rules, figure audit, draft lines, decision payoff; the shared guardrail policy (`js/guards.js`): figure scopes and number formats, verified alerts, drafts per approved option, report outcomes, partial counts, set-off timing, the names the model sees and dates with a year; the rebate board's data and geometry: every race row adds up to the engine's figures, kinds and tiers follow the engine, the year names and the board's notation for millions, a decision read from the engine's cash plan year by year (in full, in part, not at all, beyond the horizon, accepted; "approved", never "recovered"), the portfolio's year due next, the group view follows the register and the links, the band's short names, lookups map to accounts, `ui_mark_board` takes only ids of each list's kind, the constellation keeps accounts on and outside the ring, the labels of linked accounts inside the area and the legend folded when it would squeeze them (26 tests). Node.js only |
| smoke | `node tests/smoke.mjs` | A full Simulation run, with the decision on the rebate board (the claim approved, not "recovered"); key check and a model that stops early; Diagnostics and a custom what-if; the intro window (first visit, reopen, start); the rebate board by mouse and keyboard (group view, popovers that Escape closes and that give the focus back, a year's details under the race with a tip, focus kept through a redraw, the focus ring on the view buttons, hub and codes, Microsoft's look-back year in the portfolio, a portfolio row opening its group with the focus, 40 px controls and 44 px board entities, no external request); reduced motion; `file://`; a missing data file |
| sims | `node tests/sims.mjs` | All six simulations with different decision paths (Salesforce with an option that covers part of a year); markings, placeholders, no network at all, payoff on the KPI tiles and the rebate board (approved years green, the amount still lost in amber, nothing "recovered", accounts an option links gliding onto the ring, an accepted loss shown as such), audit |
| live | `node tests/live.mjs` | The live agent against `lib/fake-claude.mjs`, a scripted stand-in for the Messages API that checks every request against the protocol rules, with GLEIF, Wikidata and Frankfurter answered from fixtures in their real response shapes (`lib/fixtures.mjs`). Eight cases: a full Cisco run (parallel lookups, `pause_turn`, a 529 retry, a GLEIF 404 as an answer, a verified alert, a refused draft amount, `max_tokens` retry, audit, cost maths, Save run as simulation and replay), web search switched off, an open-data 503 and the source memory, a quick second decision, Abort, a rejected key, an empty Live sweep, and the guardrails (a web search in a response that breaks off does not count as evidence; a verified alert on the register alone, a decision on an older set of options, a posting without a set-off, a wrong amount in German number format and a summary whose outcome contradicts the decision are all refused) |
| accept | `node tests/accept.mjs` | Key lifecycle and privacy, Diagnostics → agent fallback (GLEIF blocked), the Abort/Reset matrix, Simulation fully offline (the board drawn, not one external request) |
| layout | `node tests/layout.mjs` | 1920×1080, 1600×900, 1536×864, 1366×768 and 1280×720, idle, at the finding during the run, with options, with drafts, approved with the drawer hidden, and that again with the legend opened by the presenter: no horizontal overflow, header badges never overlap the KPI tiles, the header keeps its height, one-row control bar; on the rebate board nothing leaves the panel, the legend, caption, race, band, account labels, a look-alike's struck link and company codes never cover each other, the group stays in view (the ring, or the band on one line) and no race row is cut; the other five scenarios at 1280×720 (finding, options, drafts), whose longer KPI subtitles must not push the header to a third row, and their findings at 1600×900, under the same board rules; touch targets ≥ 40 px in the main states of a run (7 checks) |
| design | `node tests/design.mjs` | The colour grammar in the running app: the rebate board's accounts (on the ring or in the band), register links, race segments, the race's key and the legend use the state tokens, before and after the decision; the status pill, console and progress rail name the human step (*Your decision*, then *Your approval*); AI labels open and close. Also writes review screenshots: the options under a simulated projector washout, and the finished run as seen with protanopia, deuteranopia and tritanopia (`review-*.png` in `rebate-hunter-tests/design/`) |

`node tests/run-all.mjs` runs everything in that order and prints a summary. Name suites to run only those (`node tests/run-all.mjs unit engine live`); name cases to run only those within a suite (`node tests/live.mjs full abort`).

No test calls a real API or spends money: Anthropic and the open-data services are replaced by fixtures inside the browser. The app loads nothing else from outside (no CDN, no map tiles), and the suites block any other request.

## Setup for the browser suites

You need Node.js 20 or later and Playwright with Chromium. Install them once, outside this folder:

```
npm install -g playwright@1.56.0
npx playwright install chromium
```

The GitHub Actions workflow pins the same version, the one the suites were last run with.

Then run with Node's module path pointing at the global packages:

```
NODE_PATH="$(npm root -g)" node tests/run-all.mjs
```

On Windows PowerShell: `$env:NODE_PATH = (npm root -g); node tests/run-all.mjs`.

Options (environment variables):
- `PLAYWRIGHT_MODULE`: path to a Playwright installation, instead of `NODE_PATH`.
- `CHROME_PATH`: use this Chrome or Chromium binary instead of Playwright's.
- `RH_TEST_OUT`: folder for screenshots, downloads and result files (default: the system temp folder, `rebate-hunter-tests/`).

The suites serve the app on `127.0.0.1` ports 8765 to 8770.

## Re-checking the legacy fingerprint

`tests/engine.mjs` holds the fingerprint of the Streamlit version's data as Python printed it. To check it again with Python 3 (standard library only):

```
python3 tools/legacy_reference.py
```
