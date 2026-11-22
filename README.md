# Rebate Hunter

An AI agent for procurement that finds supplier rebates a company earned but never claimed. It takes a tip, checks who belongs to the supplier group, lets an engine count what is owed and by when, and proposes costed ways to claim it for a person to approve.

Live site: <https://victorpflueger.github.io/PROC-Rebate-Hunter/>

**Fictional company, no client data.** GlobalCorp SE, its supplier accounts, purchases and agreements are invented. The supplier groups, their acquisitions and the dates are public facts.

## The four figures

Top right, each explained in the guide.

| Figure | What it measures | Cisco case |
|---|---|---|
| Rebate at stake | Lost if nobody claims; after your decision, what is left | €2.14M, then €0 |
| Claim deadline | Days until the first claim lapses | 31 days |
| Detection → decision | Time from the tip to your approval, measured on the page | about 4 minutes |
| Session cost | Model fees: estimated for the simulation, measured in a live run | ≈ €0.14 on Sonnet 5.5 |

## The talk track

The guide, *How the prototype works*, opens once per browser tab. When it closes, the page plays each step for as long as its words take to read and stops wherever you act, with **Your turn** and the one button to press in the bar under the story. The guide's last chapter is the presenter's script; [DEMO_SCRIPT.md](DEMO_SCRIPT.md) adds what to do and the questions that come.

The five steps are Spot (the tip), Check (who belongs to the group), Calculate (what is owed), Propose (your decision) and Prepare (the drafts). The page opens on Cisco, the biggest stake: with the two acquisitions the tip names, Cisco stays at €48M, short of the €50M threshold, so the first estimate is €0. The register finds a third, Splunk, and the count reaches €52.4M: €1.05M owed for the closed year, €2.14M with this year's.

The case menu holds five more, from Microsoft's look-back year to Salesforce's invoices in pounds. A link opens a case at a step, paused: `?case=microsoft-look-back&step=calculate`.

## Start agent: the simulation or a live run

The page opens on the simulation, a replay in which the company's records and the engine answer for real and no model is called. **Start agent** offers it again, or a live run with Claude on your own Anthropic API key, with "You are interacting with an AI system" beside both buttons that start one. The key stays in this tab and goes only to api.anthropic.com. A run stops at 40 model calls or €3.

The page connects to the model API alone, so the agent's open-data tools (GLEIF, Wikidata, the ECB's rates) report their source unavailable, and the agent confirms what it finds with Claude's web search.

## What is real

| | |
|---|---|
| Fictional | GlobalCorp SE: 3 sites, 161 supplier accounts, 1,320 orders, 8 rebate agreements, 6 cases |
| Real | The supplier groups and their acquisitions, the engine's arithmetic and, on your key, Claude |
| Written for the replay | The agent's words and its web sources, marked as representative |
| Nothing is sent | Claims and changes stay drafts, approved or not |

## How it works

A deterministic engine adds each agreement year's purchases at the contract's rates, finds the tier reached, what is owed and when each claim lapses, and costs three options. Only the subscription register joins an account to a group, never a similar name. The agent checks, explains and drafts; a person decides. Colour never carries a state alone: missed accounts are also named in words.

The engine, the twenty tools, the agent and the six scripts are 7.2.0's files, byte for byte (`tests/fingerprint.mjs`). Version 8.0.0 replaced the console around them with a presenter on Navigator's shell and Vici, Victor's design system (`vici/`):

| Module | Does |
|---|---|
| `js/main.js` | The steps, Play, keys and links, the key figures, Start agent |
| `js/shell.js` | Navigator's shell: steps, tiles, the bar that asks, cases, the key |
| `js/run.js` | Sorts a run's events into the five steps and logs every decision |
| `js/story.js` | Words each step and figure from the engine's results |
| `js/view.js` | Draws a step: the race or the group on the left, the story on the right |
| `js/plain.js` | Names, places and words instead of record ids, in one place |
| `js/estimate.js` | Estimates what a case would cost live |
| `js/live.js` | Starts the live agent on your key |

## Run it

No build step and no install. Serve the folder over http and open it in Chrome or Edge:

```
python -m http.server 8000
```

then <http://localhost:8000>. Opened from disk, the browser blocks its modules and the loading screen says so. GitHub Pages publishes `main`; the *live site* workflow checks the published page.

## Tests

`node tests/run-all.mjs` runs every suite, listed in [tests/README.md](tests/README.md); GitHub Actions runs them on every push, Vici's own checks included. No test calls the real API.

## History

Version 7.2.0 was a console with a rebate board, a drawer and Diagnostics. Its design notes, data sources, technical notes and review are in the git history (commit `73c00f8`); the unchanged engine and agent files still cite them.

## Author

Built by Victor Pflüger, on [Vici](https://victorpflueger.github.io/ViciDesign/).
