# Tests (optional, for developers)

Rebate Hunter itself needs no Node.js, npm or build step. These scripts check it after a change to code, data or words. GitHub Actions runs them on every push and pull request (`.github/workflows/tests.yml`), with ViciDesign checked out next to the app.

## What runs

| Suite | Command | Checks |
|---|---|---|
| tokens | `node tests/tokens.mjs` | The colours on Vici's values in both themes: WCAG 2.2 contrast for every text and mark the page draws (4.5:1 for text, 3:1 for marks), every token the app names exists, and how far the state colours stay apart under colour-vision deficiency (reported, not failed). Node.js only |
| page-icon | `node tests/page-icon.mjs` | `favicon.svg` byte for byte; the header and the loading screen show the lilac cell with the search icon; with Victor's website (`VIP`) next to this repository, its card gives Rebate Hunter the same icon and kind. Node.js only |
| fingerprint | `node tests/fingerprint.mjs` | The engine, the tools, the live agent, the data and the six scripts are 7.2.0's files byte for byte (`js/config.js` but for its version), and every case gives 7.2.0's first estimate, finding and options (`fixtures/fingerprint-7.2.0.json`). Node.js only |
| world | `node tools/check_world.mjs` | The world, the six cases, their reference figures and every script on every path. Node.js only |
| unit | `node tests/unit.mjs` | The streaming client: SSE parsing, thinking signatures, retries, aborts, truncated streams; the cost maths per model. Node.js only |
| engine | `node tests/engine.mjs` | The Streamlit version's accounts and orders against Python's fingerprint; the `difflib` port; golden rebate figures for all six cases; the engine's refusals; duplicate check, evidence rules, figure audit, drafts, decision payoff; the guardrails; the threshold race's data. Node.js only |
| story | `node tests/story.mjs` | What the presenter writes: record ids turned into names, every call in its step, six cases on every decision path (titles, no ids, the engine's figures before and after, waits where a person acts), the Cisco case, Play's reading times, the live-run estimate. Node.js only |
| vici | `node tests/vici.mjs` | Vici's own checks from the ViciDesign checkout, each first failing on a planted mistake: the guide and its key figures, the byline, the writing rules, the AI notice and record ids, on the page, on every sentence of six cases on every path, and on the docs; `vici/` byte for byte as ViciDesign at the commit its README names. Node.js only |
| lean | `node tests/lean.mjs` | The cut list stays out, every module is used, one stylesheet of the app's own, the page connects to the model API alone, README.md at most 900 words, DEMO_SCRIPT.md at most 700. Node.js only |
| docs | `node tests/docs.mjs` | Every figure written in the guide and on the tiles is the engine's for Cisco; DEMO_SCRIPT.md tells the guide's five steps in its words; the docs quote the engine's figures and their links resolve. Node.js only |
| showcase | `node tests/showcase.mjs` | The page in Chromium: the first screen (with Vici's own guide check), Play, the Your turn bar, six cases on every decision path, the keep list (race, AI notice, nothing sent, the log), and every step at 1920 × 1080 and 1280 × 720 in both themes, with screenshots |
| hexagon | `node tests/hexagon.mjs` | Vici's hexagon rule: nothing in the app's files or on the rendered page is round, at every step and in both themes. Each part first catches planted examples. `node tests/hexagon.mjs files` runs the file scan alone |
| live | `node tests/live.mjs` | A live run against `lib/fake-claude.mjs`, a stand-in for the Messages API that checks every request: a full Cisco run from the page (the key kept in this tab, LIVE, steps following the agent, GLEIF refused without a request, a rejection and an approval, both drafts, the cost measured), Stop during a call, and a rejected key |

`node tests/run-all.mjs` runs everything in that order and prints `ALL SUITES PASSED` when every suite passed. Name suites to run only those (`node tests/run-all.mjs story live`); name cases to run only those within a suite (`node tests/showcase.mjs play turn`).

`node tests/live_site.mjs <url>` checks the published site: it serves this checkout's files, and the Cisco case plays there. The *live site* workflow runs it after every GitHub Pages build.

No test calls a real API or spends money: the stand-in answers in the browser, and every other request is blocked.

## Setup

You need Node.js 20 or later. For the browser suites, Playwright with Chromium, installed once outside this folder:

```
npm install -g playwright@1.56.0
npx playwright install chromium
```

Then run with Node's module path pointing at the global packages:

```
NODE_PATH="$(npm root -g)" node tests/run-all.mjs
```

On Windows PowerShell: `$env:NODE_PATH = (npm root -g); node tests/run-all.mjs`.

The `vici` and `showcase` suites read Vici's checks from a ViciDesign checkout next to this repository (`../ViciDesign`) or in `VICI_DIR`; without one they say so and skip them, unless `--require-vici` is given.

Options (environment variables):
- `PLAYWRIGHT_MODULE`: path to a Playwright installation, instead of `NODE_PATH`.
- `CHROME_PATH`: use this Chrome or Chromium binary instead of Playwright's.
- `RH_TEST_OUT`: folder for screenshots and result files (default: the system temp folder, `rebate-hunter-tests/`).
- `VICI_DIR`: a ViciDesign checkout elsewhere.

## Re-checking the legacy fingerprint

`tests/engine.mjs` holds the fingerprint of the Streamlit version's data as Python printed it. To check it again with Python 3 (standard library only):

```
python3 tools/legacy_reference.py
```
