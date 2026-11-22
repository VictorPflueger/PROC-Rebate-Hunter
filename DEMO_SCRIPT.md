# Rebate Hunter: the five-minute demo

**For** a CPO, a head of procurement or a finance controller. **Goal:** after five minutes they can repeat one sentence: *"The agent found €2.14M in rebates nobody had claimed, corrected its own first count of €0, and a person approved the claim in minutes; nothing was sent."*

## The four figures at the top

| Figure | What it shows | In the demo |
|---|---|---|
| Rebate at stake | What is lost if nobody claims, then what is left after your decision | €2.14M, then €0 |
| Claim deadline | Days until the first claim lapses | 31 days, then none |
| Detection → decision | From the tip on screen to your approval, measured on the page | about 4 minutes |
| Session cost | What the agent's run costs in model fees | ≈ €0.14 for a live run |

## Before the call

1. Chrome or Edge, full screen (F11), standard zoom, light theme, notifications off.
2. Walk the five steps once. The simulation needs no key and no network.
3. Let the guide open, or start at `?guide=0` if you explain it yourself. A link to a step, such as `?step=check`, opens it paused.
4. For a live run, bring an Anthropic API key from a workspace with a spend limit; the simulation is the fallback.

## The five minutes

The guide's last chapter, *How to present*. Closing the guide starts Play: each step stays 7 to 14 seconds, and Play stops wherever you act, with **Your turn** in the bar under the story. Space pauses; → or a clicker moves on, ← goes back.

1. **Spot. It starts by itself; point at the four figures.** Close the guide with Start, then press Space. (1 min)
   “€2.14M in rebates at stake, and the first claim lapses in 31 days.”
2. **Check. Who really belongs to Cisco?** Point at Splunk, found by the agent. (1 min)
   “The tip names two acquired companies. The register finds a third, Splunk.”
3. **Calculate. The first count was wrong.** Point at the struck-through €0 and the dashed first estimate on the bar. (1 min)
   “With the two from the tip, Cisco reaches €48M, short of €50M: €0. With Splunk, €52.4M: €1.05M owed for the closed year, €2.14M with this year's.”
4. **Propose. Press Approve option A.** It sits in the bar, marked; the first figure falls to €0 and the clock stops. (1 min)
   “For €17,100 we claim all of it. A person decides, in about 4 min.”
5. **Prepare. Press Approve both.** Then open the decision log. (1 min)
   “Two drafts wait for a person; nothing is sent. Live, this costs about €0.14.”

## Questions you will get

**Is this real data?** No. GlobalCorp SE and its purchases are invented; Cisco, its acquisitions and their dates are real. In production the accounts come from the ERP and the groups from a corporate register.

**How does it know Splunk belongs to Cisco?** Only the subscription register joins an account to a group, never a similar name, and a second source confirms each company. The Apex case shows a look-alike that is another company.

**Why did the agent first say €0?** The two companies the tip named leave Cisco short of the threshold. Before accepting that, it checked the register, found Splunk and corrected the figure.

**Is the money recovered?** Not yet. Approving decides the claim; the rebate counts as recovered once Cisco pays.

**What does the AI decide?** Nothing. An engine computes every figure, the agent checks and drafts, a person approves.

## If something goes wrong

- **The page stays on its loading screen.** It was opened from a file; serve the folder over http.
- **A live run stops early.** The bar says why: the key, the network, 40 model calls or €3. Start agent, then Run the simulation.
- **The page moved on while you talked.** Press ← to go back; Space pauses. Replay plays the case again.
- **Someone asks about a close deadline.** Open Schneider and AVEVA from the case menu: its claim lapses in 9 days.
