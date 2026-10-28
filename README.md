# Rebate Hunter — Procurement Rebate Hunter

A live, agentic AI demo for procurement. Rebate Hunter watches a fictional industrial group, GlobalCorp SE (three company codes, 161 vendor accounts, eight supplier rebate agreements), and answers a question every procurement controller should ask: *which supplier rebates did we earn but never claim, how much are they worth, by when must we claim them, and what is the cheapest way to get the money back?*

**Version 7.2.0.** Static website, no backend, no build step. Runs on GitHub Pages or any static host. It looks like the rest of Victor Pflüger's work: it is built on his design system Vici, in a light and a dark theme. It replaces the Streamlit prototype (v6.2), which is preserved on the branch `legacy-streamlit`.

---

## What it is and why it matters

Large companies buy from the same supplier group through many vendor accounts: subsidiaries, acquired companies that kept their own invoicing, other company codes, other currencies. A volume rebate agreement counts the whole group ("Cisco Systems, Inc. and its Affiliates"), but the year-end rebate report counts only the accounts somebody linked to the agreement. When an acquisition is never linked, or invoices arrive in another currency or another company code, the threshold looks unreached, nobody files a claim, and the claim window closes. The money stays with the supplier.

Rebate Hunter shows an AI agent doing the joining-up in minutes. It takes an unverified tip, reads the agreement and the vendor master, checks who really belongs to the supplier group in the subscription register and against an independent public source (the Global LEI Index, Wikidata or the web), reads the ledger and the year-end report, and calculates what is owed and when each claim expires. It then proposes exactly three costed responses next to doing nothing, waits for a human decision, and turns the approved option into draft claim letters, set-off postings and master-data requests. Nothing leaves the outbox without approval, and nothing is ever sent to a real company. Every step is visible in the console: tool calls, sources, self-corrections, guardrail notes and the reasoning summary. Every model call and decision lands in an audit log that can be exported as JSON.

**The € figures do not come from the language model.** A deterministic rebate engine computes them from the company data. Option cards and KPI tiles are filled from engine results by variant id, and every amount the agent writes into an alert, an option card, a draft or the management summary is checked in code against the figures its tools returned, in any format and currency; a claim letter may quote only the result the options rest on, never a what-if.

| Preset scenario (real groups, fictional accounts) | What the agent finds | Rebate at risk |
|---|---|---|
| Cisco acquisitions | Meraki, Acacia and Splunk invoice on their own accounts. Counted with them, the Cisco group bought **€52.4M** in the agreement year and crossed **€50m**: 2 % = **€1,048,000** owed, and the current year slips the same way | €2.14M |
| Microsoft look-back | This agreement year stays at **€47.0M**, below the threshold: an honest negative. The previous year reached €51.0M, and the 15-month look-back clause still covers it | €1.02M |
| Apex look-alikes | The duplicate check calls two Apex accounts 67 % similar, but the register puts them in different groups: **no merge**. Apex Robotics Solutions alone reached the 1.5 % tier, which the report rule hid | €70,725 |
| Broadcom and VMware | Two VMware accounts sit outside Broadcom's statement, which credited the 1 % tier instead of 3 % | €1.75M |
| Schneider Electric and AVEVA | Counted across all company codes and with AVEVA, the group crossed the 2.5 % tier; the claim window closes in days | €892,500 |
| Salesforce in pounds | The report counts only euro invoices; Salesforce UK's pounds at the contract rate, plus Tableau, reach the 3 % tier | €1.52M |

*Rebate at risk* is what the gap loses within 400 days if nobody acts: the closed years' open rebate plus, where its deadline falls inside the 400 days, the current year's rebate, projected from last year (the same gap loses it too). The do-nothing card shows the projected part; for Cisco it is €1.09M of the €2.14M.

The first two rows keep the Streamlit prototype's headline figures: Cisco €52.4M → €1,048,000, Microsoft €47.0M below the threshold. Its generator is reproduced bit for bit (`tools/legacy_seed.mjs`, checked against Python in `tests/engine.mjs`), and all 150 vendor accounts and 1,203 purchase orders are carried over and dated inside the agreement year.

> **Fictional company.** GlobalCorp SE, its company codes, vendor accounts, spend and agreements are invented. The corporate groups (Cisco, Microsoft, Broadcom, Schneider Electric, Salesforce), their LEIs and their acquisitions are real, public facts. Apex Robotics (both groups) is fictional, and so are all tax ids: they fail the real check digits. See `DATA_SOURCES.md`.

For clients, the point is not the fictional company but the pattern: agentic AI that uses tools, verifies before it alerts, quantifies before it recommends, and keeps a human in charge of every outbound action. Everything runs in the presenter's browser on open data and the presenter's own Claude API key. There is no server to approve, no client data and no integration project.

## How it works

```
 Presenter's browser: static files from GitHub Pages (or any static host)
 ┌────────────────────────────────────────────────────────────────────────────┐
 │                                                                            │
 │   Live agent (js/agent.js)            ┐                                    │
 │   Claude tool-use loop, streamed      │   one stream of     ┌───────────┐  │
 │                                       ├─► run events ──────►│ Rebate    │  │
 │   Simulation player (js/simulation.js)│   (js/events.js)    │ board,    │  │
 │   scripted replay, data/sim_runs.js   ┘                     │ KPIs,     │  │
 │                                                             │ console,  │  │
 │   Tools the agent can call (js/tools.js)                    │ options,  │  │
 │    erp_*       synthetic ERP: agreements, vendor master,    │ outbox,   │  │
 │                ledger, register, year-end report            │ audit log │  │
 │    sim_rebate  deterministic rebate engine (js/rebate.js)   └───────────┘  │
 │    open_*      open-data APIs ──────────────────────────┐                  │
 │    ui_*        alert, options, drafts, report: they wait for a human       │
 │                                                         │                  │
 └───────────┬─────────────────────────────────────────────┼──────────────────┘
             │ HTTPS with your API key                      │ HTTPS, no key
             ▼                                              ▼
   api.anthropic.com/v1/messages                 GLEIF (Global LEI Index)
   Claude, plus its server-side web search       Wikidata (ownership statements)
                                                 ECB reference rates (Frankfurter)
```

- **Two producers, one interface.** The live agent and the simulation player emit the same run events, so the interface behaves the same in both modes. The mode badge, the console watermark, the evidence labels and the audit export say which mode ran.
- **Synthetic world.** `data/world.js` holds the company, its company codes, the vendor master with group keys, the purchase orders, the subscription register (who belongs to which supplier group), the rebate agreements with their clauses, and the year-end report rules. It ships as a script (`window.WORLD = …`), so nothing is fetched.
- **Guardrails in code, not only in the prompt.** Only the register merges accounts; similar names never do. Every option figure comes from the engine. An alert marked "verified" needs two distinct sources, two kinds of evidence gathered in the run, and for every account not yet linked a register check plus an independent confirmation (GLEIF, Wikidata or the web). Every amount in an alert, an option card, a draft or the summary must match a figure a tool returned. A decision counts only for the options on screen; drafts only follow it, and only of the kinds the approved option contains; the summary waits until every draft is decided and reports the decision that was taken. A response that breaks off is marked as discarded and counts for nothing. Each run is capped at 40 model calls and €3. Simulation scripts are checked against the same rules.
- **Browser-enforced boundaries.** The page's Content Security Policy only lets it connect to api.anthropic.com and the three open-data APIs, and loads nothing else from outside: scripts, styles and fonts ship with the page (the design system Vici is copied into `vici/`). The key lives in this tab's session storage only, under the app's own name.

## Deploy in five minutes (GitHub Pages)

You need a free GitHub account. The repository must be public for Pages on a free plan.

1. **Use this repository** (`PROC-Rebate-Hunter`), or create a new public one and upload the *contents* of this folder (the files and folders, not the folder itself).
   - GitHub takes **at most 100 files per web upload**. Rebate Hunter has about 120, so upload in two goes: first everything except `js/`, then that folder (**Add file → Upload files**).
   - Include the hidden file **`.nojekyll`**. It stops GitHub from running Jekyll over the Markdown files. On a Mac, press **Cmd + Shift + .** in Finder to show hidden files. If it is missing, use **Add file → Create new file**, name it `.nojekyll`, type any text, and commit.
2. **Turn on Pages.** Go to **Settings → Pages**. Under **Build and deployment → Source**, choose **Deploy from a branch**. Set the branch to **main** and the folder to **/ (root)**, then click **Save**.
3. **Open the site.** After a minute or two, reload the Pages settings page. It shows **Your site is live at `https://<your-user>.github.io/PROC-Rebate-Hunter/`**. Progress is visible under the **Actions** tab ("pages build and deployment").
4. **Check it on the presentation laptop.** Open the site and click **Diagnostics**, then **Run all tests**. Every row should pass. If an open-data row fails, the agent skips that source and says so (see Troubleshooting).

**The Streamlit version.** Streamlit Community Cloud runs `app.py` from the branch it was set up with. This version has no `app.py`, so once it is on `main`, point the Streamlit app at the branch **`legacy-streamlit`** (app settings → branch) to keep `prockickbackhunter.streamlit.app` alive, or retire it.

**Updating.** Push with git or upload the changed files again (same names overwrite). GitHub Pages caches files for up to ten minutes. After an update, hard-reload (**Ctrl + Shift + R**, or **Cmd + Shift + R** on a Mac) and check the version shown at the bottom of Diagnostics.

**Run it locally.** Browsers do not run JavaScript modules from `file://`, so double-clicking `index.html` shows a page that explains this. Start any static web server in the folder instead, for example:

```
python3 -m http.server 8000
```

On Windows, use `py -m http.server 8000`. Then open `http://localhost:8000`. Live mode works locally too, because the Anthropic API accepts browser calls from any origin.

**Free alternatives.** The folder runs unchanged on any static host: Cloudflare Pages (**Workers & Pages → Create application → Drag and drop your files**) or Netlify (drag the folder onto `app.netlify.com/drop`). A host of its own also gives the app its own origin, which keeps its browser storage apart from other apps (see *Your API key*).

## First visit

On a first visit, a short window explains what Rebate Hunter does, how it works (spot, check, calculate, propose, prepare) and why it pays off. Its **Start agent** button leads straight into the run. **How it works** in the header opens it again at any time; during a run it only explains and never interrupts.

## Reading the screen

- **Merlot is you.** Approve buttons are merlot, Vici's deep wine red, and so is the step of the progress rail that waits for you: *Your decision* for the options, then *Your approval* for the drafts.
- **Lilac is the AI.** The options, drafts and summary the agent wrote carry an **AI** label. Click it to see who wrote them and where the figures come from.
- **Red, honey and green are the money** (Vici's coral, honey and sage): rebate being lost, at risk, resolved. A word, an icon or a mark always says the same thing, so no state relies on colour alone.
- **Hexagons, not circles.** As everywhere in Vici, what would be round is a hexagon: the board's group and accounts, the rail's steps, the status pips.
- **The rebate board** sits where the Navigator shows its map. Its *group view* shows the supplier group of the agreement in focus as a hub with a ring: the accounts linked to the agreement sit on the ring (the year-end report counts them), the register members that are not linked sit outside it (the report misses them), and a look-alike the duplicate check found is held apart with a struck link, because names never merge accounts. Each account's hexagon is sized by the closed year's spend and shows its state as a mark inside (a cross, a bar and dot, a tick); register links to acquired companies are dashed; GlobalCorp's own company codes the group bills are listed below, in ink with their building and city. Above it, the **threshold race** draws one bar per agreement year against the rebate tiers: the *closed year* (the last one that ended, whose claim is due now), the *current year* (projected) and, while a look-back clause keeps it claimable, the *look-back year*. Grey is what the report counted, red what it missed, lilac stripes an unverified what-if; the key sits in the race's head, the figure on the right is what is owed or open, and the tag says whether it is the report's view, the agent's first estimate or a verified count. While the agent works, the accounts it looks up pulse in fjord blue and collect a tag for each fact a lookup confirmed (Register, Ledger, GLEIF, Wikidata, Web). When the options open the drawer, the board gets short: the ring becomes a band under the race (linked accounts inside it, the others outside) and the race keeps the years with money open. When you approve an option, the accounts it links slide into the band, and glide onto the ring once the drawer is hidden; each year then says what the option claims (*option A approved*, by which way, and when the cash comes in) or, in honey, what is still lost. Nothing reads "recovered" until a supplier has paid. The *portfolio view* lists all eight agreements, next claim deadline first, each with the year that deadline is for; the Live sweep fills it in as it checks them. Click any account, the group, a company code or a year for the details.
- **The progress rail** above the console shows the agent's plan in five steps and where it is now. **Guardrail** lines in the console show where code refused a step and why.

**Light or dark.** The page opens in the light theme, made for projectors in lit rooms. The moon in the header switches to the dark theme, and every page of Victor's site remembers the choice.

Every colour comes from Vici's tokens and is checked for contrast in both themes and for colour blindness. `DESIGN.md` explains the system, which Rebate Hunter shares with its sister prototypes, the Navigator, the Timetable Translator and Repack Pilot.

## The two modes

Clicking **Start agent** first asks how the agent should run.

| | **Simulation** | **Live agent** |
|---|---|---|
| What runs | A scripted replay of a representative agent run | Real Claude reasoning with real tool calls |
| Evidence | Representative register extracts, GLEIF records and headlines, labelled "(representative)" | Live web search, live GLEIF, Wikidata and ECB rates |
| Figures | Calculated by the rebate engine at playback | Calculated by the rebate engine |
| Key and cost | None | Your Anthropic API key; a few tens of euro cents per run |
| Network | None; works fully offline | api.anthropic.com and the open-data APIs |
| Labelling | SIMULATION badge with a striped tape, the tape and the word SIMULATION in the console, "Simulated run" in the summary, `"mode": "simulation"` in the audit export | LIVE badge, "Live agent run" in the summary, `"mode": "live"` |

- **Use Live for the real demo.** If the agent finds nothing, it says so. If a tip cannot be confirmed, it labels the analysis a *what-if*.
- **Use Simulation** for rehearsal, as the fallback on stage, and for anyone exploring without a key. Replay speed ×1, ×2 or ×4 is set in the control bar.
- **Live sweep** (control bar) checks every rebate agreement for unclaimed money with no injected scenario. It always runs live, and it works even when web search is switched off, because the register, GLEIF, Wikidata and the ECB rates need no web search.
- **Custom what-if** (Scenario menu) lets the audience type a tip, for example *"Slack invoices us from Dublin on its own account. Does it count towards the Salesforce agreement?"* It needs the live agent.

The six preset scenarios are in the table above. Each is built on real corporate facts with dates and sources (`DATA_SOURCES.md` §3).

## Your API key

Rebate Hunter asks for a key only when you start a live run: **Live agent** in the mode dialog, **Live sweep**, or a custom what-if.

1. **Create a dedicated workspace with a spend limit.** At [platform.claude.com](https://platform.claude.com), open **Settings → Workspaces → Create workspace** (needs an organisation admin), for example "Rebate Hunter demo". Select it and set a monthly spend limit under **Spend limits**, for example $10. Spend limits apply per workspace, not per key, and cannot be set on the Default Workspace.
2. **Create a key in that workspace.** Under **Settings → API keys → Create key**, scope the key to that workspace.
3. **Enter it only in the app.** Paste it when Rebate Hunter asks; it is checked with a free call that uses no tokens. Never paste the key into chat, slides or email.

What happens to the key:
- It is kept in this tab's session storage only, under the name `rh.anthropic.key`. The browser drops it when the tab closes (reopening a closed tab can bring it back), it is absent from other tabs, and it is never written to local storage, the console, the audit export or recorded runs. The key field asks password managers not to save it; if the browser still offers to, decline.
- Live mode needs Rebate Hunter in its own tab: inside another page's frame the key dialog refuses the key, so a framing page cannot steer the clicks around it. Simulation works anywhere.
- It is sent only to api.anthropic.com, in the `x-api-key` header. The page's security policy blocks every other destination.
- **Start agent → Change or forget key** removes it at any time. On a shared computer, use it before you leave: duplicating a tab copies its session storage, and browser session restore can bring a closed tab back.
- **One origin, several apps.** GitHub Pages serves all of an account's projects from one origin (`https://<user>.github.io`), and browser storage belongs to the origin. Rebate Hunter and the Navigator keep separate names (`rh.*`, `nav.*`), so they never overwrite each other, but a page of the same origin opened in the same tab could read a stored key. For a client setting, give the app its own host (a custom domain or another static host).
- Diagnostics has a **Key and privacy** row that checks all of this in your browser and says when another app of the same origin keeps a key in the tab.

## What a run costs

The cost meter in the header shows the real cost of every call as it happens (token usage × list price, plus $10 per 1,000 web searches, converted at 1 USD = 0.894 EUR). The audit export holds the usage of every model call.

| Model (selector) | Per preset scenario run | Notes |
|---|---|---|
| **Sonnet 5.5** (default) | expect about €0.15–0.40 | Best balance for the stage |
| Haiku 5.5 | about €0.02–0.06 | Fastest; the search fee dominates |
| Opus 5.5 | about €0.35–0.90 | Deepest reasoning, slower |

These are estimates: Rebate Hunter's prompt and tool set are of the same size as the Navigator's, whose Sonnet runs measured about €0.20. Measure your own with the cost meter during rehearsal. A Live sweep reads more data and can cost a little more. Diagnostics' optional web-search test costs about €0.0001. Each run stops on its own if it passes €3.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Page says it must be opened through a web server | It was opened from disk (`file://`). Use GitHub Pages or `python3 -m http.server` (see above). |
| GitHub Pages shows 404 | Wait two minutes after enabling Pages and check the **Actions** tab. Make sure `index.html` is in the repository root and the branch is `main` with folder `/ (root)`. |
| Old version after an update | Pages caches for up to ten minutes. Hard-reload and check the version in the Diagnostics footer. |
| "Could not reach api.anthropic.com", or Diagnostics fails the Anthropic API row | A firewall, proxy or browser extension blocks the call (this looks like a CORS or network error). Try another network, such as a phone hotspot, or another browser profile without extensions. Simulation mode works offline. |
| "Anthropic rejected the API key (401)" | The key is wrong, expired or archived. Rebate Hunter removes it from the tab; enter a valid one. |
| Error that mentions a workspace | The key works in several workspaces, and the API needs to know which one. Create a key scoped to a single workspace. |
| "Spend limit reached" or "no credit" | Raise the workspace's spend limit or add credit in the Console, or switch to Simulation. |
| Banner "Web search is switched off for this API key" | An organisation admin has disabled Claude's web search. Rebate Hunter keeps going with the register, GLEIF, Wikidata and the ECB rates; preset scenarios, the Live sweep and Simulation work. |
| The GLEIF, Wikidata or ECB row fails in Diagnostics | That provider is blocked or down from this network, or (GLEIF) does not allow calls from a web page here. Nothing to fix: the agent skips the source, says so in the console and verifies through another source or web search. |
| The group is a band under the race, and the race shows fewer years | The board is short, usually because the drawer is open (or the legend you opened leaves the group no room beside it). The band keeps the picture (linked accounts inside the ring, the others outside, the same colours and details), and the race keeps the years with money open ("+1 year not shown"). Click **Hide** on the drawer, or fold the legend, to see the whole group and every year again. |
| "The API is busy right now" | Anthropic returned overloaded or rate-limit errors after two automatic retries. Wait a minute, switch to Haiku, or run the Simulation. |
| Run ends as **Stopped** | The model ended its turn twice without finishing; Rebate Hunter does not invent the rest. Start again, or switch to the Simulation of the same scenario. |
| A **Guardrail** line appears in the console | Code refused a step (for example a draft quoting an amount no tool returned). The agent is told why and corrects it; the run facts count these refusals. |
| Text too small on the projector | Use **Larger text** in the console header. The layout is tested at 1920×1080 and down to 1280×720. |

## Recording a live run for Simulation mode

After a completed live run of a preset scenario, click **Save run as simulation** (end of the console). Rebate Hunter validates the recording and downloads `sim-run-<scenario>-recorded-<date>.js`. Append that file's content to the end of `data/sim_runs.js`: from then on, Simulation mode replays that real run for the scenario, labelled "Replay of a live run recorded on <date>". Evidence is shown as "(recorded <date>)", € figures are recomputed by the engine, the replay runs on the recording day so the dates in its narration still match, and only the decision path that was taken live can be replayed. A recording carries the world and engine versions; when either changes, Diagnostics reports it as stale and it should be recorded again. Delete the appended block to return to the authored script.

Record on Sonnet, approve the recommended option, and read the run before you ship it. If the reasoning would not survive a partner's questions, record again.

## Safety and the EU AI Act

Rebate Hunter is designed along the transparency and human-oversight lines of the EU AI Act. This is a design intent, not a legal assessment.
- **Disclosure.** "You are interacting with an AI system" is shown permanently in the header.
- **Human oversight.** Options wait for a human decision, and each draft waits for its own approval. A run that ends without a decision shows its options and drafts as undecided.
- **No real-world action.** The outbox has no email or ERP integration; approval only marks a draft as cleared. Postings say "Mock posting for demonstration; no ERP system is connected."
- **Record-keeping.** The audit export contains every run event, every model request and response (minus thinking signatures and encrypted search content), the mode, the run facts and the cost.
- **Honest modes.** Simulation output is labelled everywhere and never presented as live.

## Quality and acceptance

- The **run facts** line at the end of every run states agent time (excluding time spent waiting for your decisions), tool calls by kind, visible verification steps, revisions, guardrail refusals and cost. The same facts are in the audit export.
- `node tools/check_world.mjs` checks the synthetic world, the scenarios, the reference cases and all six simulation scripts (34 checks), holding every script to the live agent's guardrails. It needs Node.js only.
- `node tests/engine.mjs` checks the legacy data against Python, the name-similarity port against Python's `difflib`, the rebate engine against frozen golden figures for all six scenarios, the guardrail policy, and the rebate board's figures, decisions and geometry (26 tests).
- `node tests/tokens.mjs` checks the colour system on Vici's values in both themes: contrast for every text and state pairing, and how far the state colours stay apart for colour-blind viewers. `node tests/hexagon.mjs` checks that nothing in the app is round, `node tests/page-icon.mjs` that the page icon matches the prototype's card on Victor's website, and `node tests/vici-files.mjs` that `vici/` holds exactly Vici's files.
- `tests/` contains the test suites (Node.js; the browser suites need Playwright). See `tests/README.md`; GitHub Actions runs them on every push. `TECH_NOTES.md` §12 lists the acceptance items with their evidence, §11 is the verification log.

## Files

| Path | Contents |
|---|---|
| `index.html` | The single page, its security policy and the boot screen |
| `vici/` | Victor's design system Vici (stylesheet, script, tokens, fonts, the byline's portrait and LinkedIn's logo), copied unchanged; `vici/README.md` lists the files, their release and their licences |
| `css/` | The app's styles on top of Vici: layout, components, console, drawer, rebate board, dialogs (shared with the sister prototypes except `board.css`) |
| `js/` | ES modules, one responsibility each (see below), and `theme.js`, which sets the theme before the page is drawn |
| `favicon.svg` | The page icon: Vici's search icon in a lilac hexagon, as on the prototype's card on Victor's website |
| `data/world.js` | The synthetic company: company codes, vendor master, purchase orders, register, agreements, report rules (generated by `tools/build_world.mjs`) |
| `data/scenarios.js`, `data/reference_cases.js` | The six preset scenarios and their engine reference cases |
| `data/sim_runs.js` | The six simulation scripts |
| `tools/` | The world builder, the legacy seed port and its Python reference, the world check |
| `tests/` | Optional test suites (Node.js; browser suites need Playwright) |
| `README.md`, `DEMO_SCRIPT.md`, `DATA_SOURCES.md`, `TECH_NOTES.md`, `DESIGN.md`, `REVIEW.md` | This guide, the stage script, every data source, verified API facts and decisions, the design system, and the Navigator review with the parity checklist |

Main modules: `agent.js` (live tool-use loop), `anthropic.js` (streaming client, retries), `prompt.js` (system prompt), `tools.js` (tool definitions and executors), `guards.js` (the guardrail policy shared by the live tools and the script checker), `erp.js` (ERP queries), `rebate.js` (rebate engine), `world.js` (indexed company model), `clock.js` (today, pinned for recorded replays), `similarity.js` (Python `difflib` port), `opendata.js` (GLEIF, Wikidata, ECB), `source_health.js` (which data sources failed in this session), `figures.js` (figure audit), `drafts.js` (draft footers), `payoff.js` (option figures and decision effects), `simulation.js` (replay), `sim_vars.js` and `sim_check.js` (script placeholders and validation), `recorder.js` (Save run as simulation), `events.js` (run-event bus), `ui.js` (orchestration), `intro.js`, `progress.js` (the progress rail), `handover.js`, `ai_label.js`, `labels.js` (console label rules), `board.js` (the rebate board) with `board_data.js` (what it draws, from the engine and the ERP), `board_race.js` (threshold race), `board_group.js` (the group and its accounts), `board_band.js` (the group as a band on a short board), `board_portfolio.js` and `board_pop.js` (details popover), `popovers.js`, `icons.js` (Vici's icons by name, and the ten drawn in Vici's style), `console.js`, `kpi.js`, `options_panel.js`, `outbox.js`, `audit.js`, `diagnostics.js`, `keystore.js` (session-only key), `cost.js`, `run_facts.js`.

## Credits and licences

Design system: Vici by Victor Pflüger (MIT for its code; `vici/LICENSE`), with its fonts Bricolage Grotesque, Inter and JetBrains Mono (SIL Open Font License 1.1); Victor's portrait is his own, LinkedIn's logo LinkedIn's. Live data: GLEIF LEI data (CC0), Wikidata (CC0), euro reference rates of the European Central Bank via the Frankfurter API. Claude and its web search are services of Anthropic, billed to your own key. Details are in `DATA_SOURCES.md`.

## Author

**Victor Pflüger** — Senior Consultant, Data Science & AI · [linkedin.com/in/victorpflueger](https://www.linkedin.com/in/victorpflueger)

*A portfolio prototype that shows how an agentic, human-supervised workflow surfaces real, auditable value in enterprise procurement, built as the sister of the Navigator for supply-chain disruptions.*
