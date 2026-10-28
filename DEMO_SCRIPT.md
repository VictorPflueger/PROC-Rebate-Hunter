# Rebate Hunter — 8-minute demo script

**Audience:** partners, principals, procurement and finance leads, later clients. **Goal:** in eight minutes they should be able to repeat one sentence: *"We find in minutes the rebates we earned but never claimed, what they are worth, by when we must claim them, and the cheapest way to get the money back."*

**Recommended run:** Scenario 1, **Cisco acquisitions**, in **Live** mode on **Sonnet 5.5**. The tip names two acquired companies, Meraki and Acacia, that invoice on their own accounts. The agent checks the subscription register and finds a third the tip missed, Splunk, then confirms it in the live Global LEI Index and Cisco's own announcements, and corrects itself in front of the audience. With all three, the Cisco group bought €52.4M in the agreement year that just closed and crossed the €50M threshold: 2 % = €1,048,000, with the claim deadline about a month away. Every figure comes from the deterministic engine, so the numbers are the same in every run.

**Alternatives:** Scenario 3, **Apex look-alikes**, shows the opposite discipline: two accounts that look like one supplier (67 % name similarity) are *not* merged, because the register puts them in different groups. Scenario 5, **Schneider Electric and AVEVA**, has the most urgency: the claim window closes in days.

**Fallback:** the same scenario in **Simulation** mode at ×2. It uses the same interface, is labelled SIMULATION throughout, and needs no key or network.

---

## Pre-flight (30 minutes before, on the presentation laptop and network)

1. Open the site in Chrome or Edge and hard-reload (**Ctrl + Shift + R**). On a browser's first visit the **How Rebate Hunter works** window opens by itself; close it. Close other tabs and silence notifications. Plug in the power and disable sleep.
2. Click **Diagnostics → Run all tests**. Check that every row passes and that the footer shows **Rebate Hunter 7.2.0**.
   - The **GLEIF**, **Wikidata** and **ECB** rows show what the open data returned (for example today's pound rate). A failed row is fine: the agent says so on screen and verifies through another source or web search. GLEIF does not document whether web pages may call it, so this row is the one to look at on a new network.
   - Optional: **Test web search on my key** (≈ €0.0001) confirms that your organisation allows web search.
3. Do one full **Live** rehearsal of the scenario. It enters your key (Start agent → **Continue with my API key** → paste → **Check key and continue**) and confirms timing and cost: the console's last line shows the **Run facts**. Then click **Reset**. **Keep this tab open.** The key lives only in this tab.
4. Run the **Simulation** of the same scenario once at ×4 to refresh the flow in your head. Click **Reset**.
5. Set the stage: Scenario menu → **Cisco acquisitions**, Model → **Sonnet 5.5**, console **Larger text** on, browser full screen (**F11**). The page is in the light theme, which projectors in lit rooms show best (the sun in the header switches back from dark). The status pill reads **Idle**.
6. Have a phone hotspot ready. Never paste the key on the projector, in chat or in slides.

## The eight minutes at a glance

| Time | Segment | On screen |
|---|---|---|
| 0:00–0:30 | Hook | Idle workspace: the rebate board on the Cisco group and the year-end report's count, empty KPI tiles |
| 0:30–1:00 | Mode choice | Mode dialog: Simulation or Live agent |
| 1:00–5:00 | The run | Console, rebate board and KPIs fill live; options open in the drawer |
| 5:00–7:00 | Decision, outbox, summary | Approval, claim letter and master-data request, management summary, audit export |
| 7:00–8:00 | Audience what-if | Custom what-if typed from the room (Live only) |

---

## 1. Hook (0:00–0:30)

On screen: the rebate board. In the middle is the Cisco group. The two accounts on its ring are linked to the Cisco rebate agreement, so the year-end report counts them; the faded ones outside are accounts the agreement does not know. The bar above is the threshold race: what the report counted in the closed year, €32.3 million, against Cisco's €50 million tier, and under it the current year, which the report has not run yet. The buttons in ink at the bottom, each with a building, are GlobalCorp's own company codes that Cisco bills, with their city. If the room needs a picture of the flow first, click **How it works** in the header: its five steps (spot, check, calculate, propose, prepare) are the run you are about to show, and its **Start agent** button leads straight into segment 2.

> "This is GlobalCorp, a fictional industrial group buying from real suppliers: Cisco, Microsoft, Broadcom, Schneider Electric, Salesforce. They all pay volume rebates, but only if the buyer counts its purchases from the whole supplier group, and claims in time. After a few acquisitions, nobody does. Our own report says Cisco is far from its threshold. Let's watch an AI agent check that in about four minutes, and ask for permission before it does anything."

Point at the five steps above the console, the agent's plan. One sentence on the colours, if the room is new to the screen:

> "Merlot is you, lilac is the AI, red, honey and green are the money. When a step turns merlot, it's our turn."

## 2. Mode choice and key (0:30–1:00)

Click **Start agent**. The mode dialog opens.

> "Two honest modes. Simulation is a labelled replay we use for rehearsal; it costs nothing and runs offline. Live is the real thing: Claude reasoning with live registers and the web, on my own API key. We'll go live."

Click **Use my key (sk-ant-…)** on the Live card. Point at the header: **LIVE** badge and **You are interacting with an AI system**.

> "The key stays in this browser tab and only goes to Anthropic. The browser itself blocks the page from connecting anywhere else."

## 3. The run (1:00–5:00)

Narrate what the console shows; do not read it out. The left column says what to watch for, the right column what to say. A live run words things its own way; the moments are the same.

| Console moment | You say |
|---|---|
| **Phase: Scanning.** The opening line restates the tip: Meraki and Acacia invoices sit on their own accounts and never count towards the Cisco rebate | "This is how lost money arrives: as a hunch from a category manager, not as a report." |
| ERP calls: `erp_get_agreement`, `erp_list_vendors`; **Hypothesis:** the two accounts carry no Cisco group key; the race shows the agent's **First estimate** (lilac tag): with Meraki and Acacia the bar still stops short of the €50M tick | "First question: what does the contract count, and which of our accounts does it know? Only two are linked. Even with the two from the tip, Cisco stays below the threshold. A lazy analyst would stop here." |
| **Check:** `erp_family_tree` (the subscription register), `open_gleif_parent` (the Global LEI Index, live) and web search with sources | "Now it refuses to trust a name. It asks the register who really belongs to Cisco, and checks it against the official LEI index and Cisco's own announcements." |
| **Revised: two acquired accounts → three** | "Watch this: the tip said two. The register says three: Splunk belongs to Cisco since March 2024, and nobody linked it either. It corrects itself in public." |
| **Alert card** with **Checked in this run:**; on the board the three accounts outside the ring and their register links turn red with a cross inside, each with tags for what the run checked about it (Register, GLEIF, Web, Ledger), while the two linked accounts stay grey: the report counts them | "Only now, with the register and an independent source behind every account, does it raise a verified alert. The last line lists what was actually checked, from the tool results, not from the agent's words." |
| **Phase: Simulating**; `sim_rebate` calls; the race recounts with Splunk: three red segments push the bar past the €50M tick, the bracket under them reads **€20.10M missed by the report**, and the tag reads **Verified count**; **Rebate at risk** and **Claim deadline in** tiles fill | "These numbers do not come from the language model. A deterministic engine calculates them from the ledger and the contract: €52.4 million in the agreement year that just closed, over the €50 million threshold, so 2 % is owed, and the claim window closes in about a month. The €2.14 million at risk is that claim plus this year's rebate, which the same gap would lose too; the do-nothing card shows the split." |
| **Phase: Options**, **Review options**; the drawer opens with three options, *Do nothing* and the comparison bars; the board gets short, so the group becomes a band under the race (the linked accounts inside the ring, the three red ones outside); the rail's **Propose** step turns merlot: **Your decision** | "Exactly three costed options next to doing nothing: claim and fix the vendor master, set it off against open Cisco invoices, or claim only. The bars show what each costs plus what is still lost. It recommends the lowest expected total, and the step has turned merlot: nothing happens until a human decides." |

If the run reaches the options before 5:00, click **Hide** on the drawer and use the spare time on the board: click a red account (its register entry and what the run checked), or the closed year in the race (every account the agreement counts, against what the report counted; the details open under the race). Or open a **Reasoning** entry in the console to show the model's summarised thinking.

If a **Guardrail** line appears, point at it: "The code just refused a step, for example an amount no tool returned. The agent is told why and fixes it. That's the safety net working, in plain sight."

## 4. Decision, outbox and summary (5:00–7:00)

Click **Approve** on the recommended option.

> "I approve the recommendation. Look at the tiles: rebate at risk now shows what is left with this option, nothing here. On the board Meraki, Acacia and Splunk slide into Cisco's ring: from now on the report counts them. Each year says *option A approved*, how the money comes back and when. Approved, not recovered: nothing is booked until Cisco pays."

To show the payoff on the full board, click **Hide** for a moment: the three accounts glide onto the ring. Then reopen the **Outbox**.

The agent drafts the actions. The **Outbox** opens with a claim letter to Cisco and an internal request to Master Data Management, each **Pending approval**.

> "It drafts the claim letter and the vendor-master change, and only those: the code lets it draft only what the approved option contains. Every amount in them was checked in code against the engine's figures, every draft carries the AI footer, and none of them is sent: this outbox has no connection to anything. Each one needs its own approval."

If there is time, click the lilac **AI** label on a draft: it says who wrote the draft, that its amounts were checked, and that approving sends nothing.

Approve the claim letter and **Reject** the other draft to show the control. The agent finishes; click **Open management summary** and read its first two sentences.

> "A board-ready summary: what we found, what doing nothing costs, what we decided, how we know. And the **Detection → decision** tile shows how long it took from the tip to our decision."

Open the **Audit** tab and click **Export JSON**.

> "Every tool call, every model message, every human decision, with timestamps and cost. That is what makes this auditable, and it is what the EU AI Act asks for in spirit: disclosure, human oversight and records."

Point at the console's last line: **Run facts: … agent time; … tool calls; … verification steps; cost €0.2x.**

## 5. Audience what-if (7:00–8:00, Live only)

> "Everything you saw was live. So give me a hunch about one of our suppliers."

Scenario menu → **Custom what-if…**. Type the suggestion in a sentence, for example *"Slack invoices us from Dublin on its own account. Does it count towards the Salesforce agreement?"*, and click **Start agent**, then the Live card.

> "It starts exactly as before: which agreement, which accounts, who really belongs to the group, what is owed and by when. It will take three or four minutes; we'll leave it running and look at the result over coffee."

Close while it works:

> "Minutes, not weeks, from a hunch to a costed claim, with a human in charge of every action. The same pattern works on your own vendor master and contracts."

---

## Contingencies

**Slow response (nothing new in the console for 20 seconds).** The status pill shows the phase and the stopwatch keeps running. Say:
> "It's waiting for the model. Real reasoning has real latency; I'd rather show you that than a pre-recorded video."

Use the pause to explain the board or the KPI tiles. If nothing has moved for about a minute, click **Abort**, set Replay to **×2**, then click **New run → Run simulation**:
> "Let's switch to the replay of this scenario. Same interface, clearly labelled SIMULATION."

**API error, network loss or Wi-Fi problems.** The console states the cause in plain words (rate limit, network, key). Switch to the phone hotspot if it is quick; otherwise run the Simulation, which needs no network at all.

**An open-data source fails mid-run.** The console says which one and that the agent falls back to another source or web search. Say:
> "The LEI index isn't reachable from this network. Notice it doesn't pretend: it says so and checks another way."

**Empty Live sweep.** If you run **Live sweep** and the agent ends with "no material finding", say:
> "That's the right answer when the books are clean. An agent that finds money every time is a liability. Let me inject a tip instead."

Then run Scenario 1 or 5.

**The tip cannot be confirmed (what-if path).** The agent says it could not confirm the group membership and continues as a labelled what-if.
> "It won't claim money from a supplier on a hunch. It labels this a what-if and still quantifies it, which is exactly the behaviour you want from an agent that writes to suppliers."

**The run ends as Stopped or Error.** Read the console's reason aloud in one sentence, then run the Simulation.

**Questions you will get**

| Question | Answer |
|---|---|
| "Is this real?" | "The buyer is fictional, and so are its accounts and contracts. The supplier groups, their legal entities, LEIs and acquisitions are real, the LEI index and exchange rates are read live, and in Live mode the reasoning is real Claude on my key. Nothing touches a real supplier." |
| "Why not just match vendor names?" | "Names lie both ways. Meraki and Cisco share 23 % of their name and belong together; the two Apex accounts share 67 % and don't. Only a register of who owns whom can merge accounts, and the code enforces that." |
| "Can the AI make up the numbers?" | "Not the money. A deterministic engine computes every euro figure and deadline; option cards and tiles come straight from it, and any amount the agent writes into an alert, a letter or the summary is checked in code against the tool results, whatever format or currency it is written in. A letter may only quote the figures the options rest on, never a what-if." |
| "What does a run cost?" | "Tens of cents on the default model. The meter in the corner shows it live." |
| "What about the EU AI Act?" | "It discloses that you're dealing with an AI system, keeps a human in charge of every outbound action, and logs everything for export. Nothing is sent automatically." |
| "Could it run on our data?" | "Yes. The agent talks to the company through a handful of tools: agreements, vendor master, ledger, the group register, the rebate report. Point those at your ERP and your corporate-hierarchy subscription, and the guardrails stay the same." |
| "Which model is this?" | "Claude Sonnet 5.5 by default; Haiku for speed and cost, Opus for depth. It's a dropdown." |
| "Why these colours?" | "Each colour means one thing: merlot is a person deciding, lilac is the AI, red, honey and green are the money, and every state also has its own mark, so nobody needs the colours to read it. They come from Vici, the design system behind all our prototypes, tested for contrast in a light and a dark theme and for colour blindness; our supply-chain Navigator uses the same. And nothing is round: the shapes are hexagons, Vici's signature." |
| "Why is there no map?" | "Because a rebate doesn't depend on where a supplier sits. It depends on who belongs to the supplier group, whether the contract counts them, and how far the spend is from the threshold. The board shows exactly those three; our supply-chain Navigator, where location matters, has the map." |
| "Is my data safe in the browser?" | "There's no server. The key stays in this tab and only goes to Anthropic. The browser blocks the page from connecting to any other host, and Diagnostics checks that." |

## After the demo

- **Start agent → Change or forget key → Forget key**, or close the tab.
- If the key was ever visible on screen, delete it in the Claude Console and create a new one.
- To keep a good live run as the new Simulation for that scenario, use **Save run as simulation** (see README, "Recording a live run").
