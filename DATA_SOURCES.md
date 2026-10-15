# DATA_SOURCES — what Rebate Hunter is built on

Rebate Hunter uses **no data from the user or any client**. Everything is one of three things:

1. **Synthetic data.** Invented for this prototype: the fictional company GlobalCorp SE, its company codes, vendor accounts, purchase orders, spend, rebate agreements and report rules.
2. **Public reference knowledge.** Real corporate groups, their Legal Entity Identifiers (LEIs) and their acquisitions, with the date and source of each fact below so it can be checked.
3. **Live open data.** Keyless public APIs and Claude's own server-side web search, called from the presenter's browser at run time.

This file backs the stage claim *"real groups, real acquisitions, a fictional buyer"*. Every row says what is real and what is invented. Facts were checked on **14 October 2026**; GLEIF data is from the golden copy published that morning.

> **Fictional entities.** GlobalCorp SE, its company codes and every vendor account, amount and agreement are invented. The account names of real groups are invented billing accounts; the legal entities, LEIs and acquisitions behind them are real. Apex Robotics (both groups) and the 141 noise vendors carried over from the Streamlit version (names such as "Inno IT-Services AG") are invented; any resemblance to real companies is unintended. No real company's spend, prices, agreements or contract terms are used.

---

## 1. Live data sources (called from the browser at run time)

| Source | Endpoint(s) | Used for | Licence / terms | Notes |
|---|---|---|---|---|
| **Claude web search** (Anthropic, server-side tool `web_search_20250305`) | via `POST https://api.anthropic.com/v1/messages` | Acquisition announcements, press coverage, any fact outside the open-data APIs | Billed to the user's own API key ($10 per 1,000 searches + tokens) | Runs on Anthropic's servers, so no CORS issue. Admins can disable it per organisation; Rebate Hunter then works on the register and the open-data APIs |
| **GLEIF** Global LEI Index API (`open_gleif_search`, `open_gleif_parent`) | `https://api.gleif.org/api/v1/lei-records?filter[fulltext]=…`, `…/lei-records/{lei}`, `…/lei-records/{lei}/ultimate-parent`, `…/lei-records/{lei}/ultimate-parent-relationship` | Who a legal entity is (name, address, status) and who ultimately consolidates it (level-2 relationship data): an independent check of the register | LEI data under **CC0** (GLEIF LEI Data Terms of Use, II.3, https://www.gleif.org/en/meta/lei-data-terms-of-use); access is free ("There is no charge for the use of GLEIF's LEI data", API documentation). Rate limit: **60 requests per minute per user** (API documentation) | GLEIF disclaims accuracy and currency (Terms V.3). **CORS is not documented**; Diagnostics tests it in the presenter's browser |
| **Wikidata** Action API (`open_wikidata_owner`) | `https://www.wikidata.org/w/api.php?action=wbsearchentities…&origin=*`, `…?action=wbgetentities…&origin=*` | Ownership statements: owned by (P127), parent organization or unit (P749), with start and end times (P580, P582), and the LEI (P1278) | Structured data under **CC0** (https://www.wikidata.org/wiki/Wikidata:Licensing); Wikidata asks to be mentioned as the source | Crowd-sourced: a lead, never the only source for a merge. Anonymous cross-origin requests are documented with `origin=*` (https://www.mediawiki.org/wiki/API:Cross-site_requests) |
| **ECB euro reference rates** via the **Frankfurter** API (`open_ecb_rate`) | `https://api.frankfurter.dev/v1/latest?base=EUR&symbols=GBP`, `…/v1/{YYYY-MM-DD}?…` | Today's market rate next to an agreement's fixed contract rate | No key ("You don't need an API key", https://frankfurter.dev/); CORS open ("CORS is open and there's no key to leak", https://frankfurter.dev/javascript/). The ECB publishes the rates "for information purposes only" and discourages using them for transactions (euro reference rates page, https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html); its copyright terms require that "the ECB must be cited as the source" when the information is reproduced (https://www.ecb.europa.eu/services/disclaimer/html/index.en.html) | Frankfurter's v1 API is deprecated in favour of v2 "but remains available indefinitely". On 14 Oct 2026 its v1 values for GBP, USD, JPY and others equalled the ECB's daily reference rates (for example €1 = £0.84385) |

Exact parameters and response shapes are in `TECH_NOTES.md` §4. If a call fails, the agent says so in the console and verifies through another source or web search; a failed source is skipped for ten minutes so the run does not stall on it.

## 2. Geography and front-end assets

Since version 7.1.0 Rebate Hunter draws no map and loads no map data: its centrepiece is the rebate board (`TECH_NOTES.md` §5, D-R42), drawn from the synthetic company alone. The world keeps the cities and countries the details show (each vendor account's invoicing city, the company codes' cities, the groups' headquarters cities) and no coordinates.

The only front-end assets are the fonts Barlow, Barlow Semi Condensed and IBM Plex Mono (SIL Open Font License 1.1), served from the app itself so no visitor data goes to a font service. There is no runtime library and no CDN.

## 3. The synthetic company — what is invented and what is anchored

### 3.1 GlobalCorp SE and its company codes (fictional)

| Company code | Entity | City | Currency | Role |
|---|---|---|---|---|
| CC-1000 | GlobalCorp SE | Frankfurt am Main | EUR | Group headquarters and central procurement; global IT and software contracts |
| CC-2000 | GlobalCorp UK Ltd | Birmingham | GBP | UK operations; invoices in pounds sterling and euros |
| CC-3000 | GlobalCorp France SAS | Lyon | EUR | French operations |

Every rebate agreement covers the purchases of GlobalCorp SE and its affiliated companies, that is all three company codes, unless its clause says otherwise.

### 3.2 Vendor master (161 accounts) and purchase orders (1,320)

| Part | Accounts | Orders | Origin |
|---|---:|---:|---|
| Storyline accounts of the Streamlit version (Cisco, Microsoft, Apex) | 9 | 167 | `app.py` v6.2, carried over (names, cities, spend; three tax ids replaced, see below) |
| Noise accounts of the Streamlit version | 141 | 1,036 | Generated by `app.py` with Python's `random`, seed 1337; regenerated bit for bit by `tools/legacy_seed.mjs` and checked against `tools/legacy_reference.py` (SHA-256 of all accounts and orders). `app.py` drew each account's country independently of its city ("Paris, AT"); the world gives each account its city's country, which changes the country of 119 of the 141 |
| Scenario accounts added for Rebate Hunter (Broadcom, VMware, Schneider Electric, AVEVA, Salesforce, Slack, Tableau) | 11 | 117 | Invented billing accounts of real groups, `tools/build_world.mjs` |

- **Spend.** The Streamlit version's year-to-date spend becomes each account's spend in its agreement's last closed year (AY). Its order dates (1 January to 28 May) are spread over that year in order. Seven noise accounts take their order total instead of their stated spend: `app.py` truncated cents when it split the spend into orders, so their orders add up to one cent less. The previous year (PY) is invented (84–110 % of AY for noise accounts); the running year (CY) is projected by each agreement's growth assumption.
- **Group keys.** As in SAP's vendor master field KONZS: set on the accounts linked to an agreement, empty everywhere else, including every acquired company. That gap is what the scenarios are about.
- **Open payables** (for set-off) are invented, 4–9 % of a year's spend for noise accounts.
- **Tax ids are invented and cannot be real.** German, British and Irish VAT numbers fail their check digit, and US ids start with 00, which the IRS never issues. Three of the Streamlit version's ids passed a real check (two US-format ids and one German VAT number) and were replaced; the noise accounts' random "EU…" ids are kept as generated.

### 3.3 Corporate groups and the subscription register (real facts)

The subscription register stands for a corporate family-tree service such as the ones procurement teams subscribe to. Its entries for real groups use real legal entities, LEIs and acquisition dates; the vendor accounts they point from are fictional. For acquired companies the register names the legal entity behind the acquisition (with its LEI), not the local billing entity a real register would resolve.

**Ultimate parents** (GLEIF records fetched 14 Oct 2026; all ACTIVE and ISSUED):

| Group | Ultimate parent (GLEIF legal name) | LEI | GLEIF legal address | Headquarters (city in the world data) |
|---|---|---|---|---|
| G-CISCO | CISCO SYSTEMS, INC. | 549300LKFJ962MZ46593 | Wilmington, US | San Jose |
| G-MSFT | MICROSOFT CORPORATION | INR2EJN1ERAN0W5ZP974 | Tumwater, US | Redmond |
| G-AVGO | BROADCOM INC. | 549300WV6GIDOZJTV909 | Wilmington, US | Palo Alto |
| G-SCHN | SCHNEIDER ELECTRIC SE | 969500A1YF1XUYYXS284 | Paris, FR | Rueil-Malmaison |
| G-CRM | SALESFORCE, INC. | RCGZFPDMRW58VJ54VR07 | Wilmington, US | San Francisco |

US legal addresses in GLEIF are registered-agent cities, not headquarters. Records: `https://api.gleif.org/api/v1/lei-records/{LEI}`; human-readable at `https://search.gleif.org/#/record/{LEI}`.

**Acquired companies** (completion dates from the acquirer's announcement or filing; GLEIF records fetched 14 Oct 2026):

| Account | Legal entity (register) | LEI | GLEIF status | GLEIF ultimate parent | Completed | Source |
|---|---|---|---|---|---|---|
| 10003 Meraki Cloud Networks | Meraki (Cisco Meraki) | none | — | — | 20 Dec 2012 | Cisco newsroom, "Cisco Completes Acquisition of Meraki": https://newsroom.cisco.com/c/r/newsroom/en/us/a/y2012/m12/cisco-completes-acquisition-of-meraki.html |
| 10004 Acacia Communications Opto | Acacia Communications, Inc. | 549300PZLTIVLKOBPB61 | ACTIVE, registration LAPSED | none reported | 1 Mar 2021 | Cisco newsroom: https://newsroom.cisco.com/c/r/newsroom/en/us/a/y2021/m03/cisco-completes-acquisition-of-acac-1.html |
| 10005 Splunk Software EMEA | SPLUNK LLC | 549300XGDSGBP6UEI867 | ACTIVE, ISSUED | Cisco Systems, Inc.; relationship period from 18 Mar 2024 | 18 Mar 2024 | Cisco newsroom: https://newsroom.cisco.com/c/r/newsroom/en/us/a/y2024/m03/cisco-completes-acquisition-of-splunk.html |
| 20002 Activision Blizzard Germany | ACTIVISION BLIZZARD, INC. | 549300TPQQDBP9GNOF40 | ACTIVE, registration LAPSED | Microsoft Corporation (relationship period reported from 3 Jul 2001; entity-supplied, record lapsed) | 13 Oct 2023 | Microsoft Form 8-K, Item 2.01: https://www.sec.gov/Archives/edgar/data/789019/000119312523255762/d537928d8k.htm; Official Microsoft Blog, "Welcoming the legendary teams at Activision Blizzard King to Team Xbox": https://blogs.microsoft.com/blog/2023/10/13/welcoming-the-legendary-teams-at-activision-blizzard-king-to-team-xbox/ |
| 50003 VMware International Unlimited Co. | VMWARE INTERNATIONAL UNLIMITED COMPANY (Dublin) | 549300QDZDZP3SLIME17 | ACTIVE, ISSUED | Broadcom Inc. (relationship period reported from 2 Oct 2017) | 22 Nov 2023 | Broadcom press release filed with its 8-K: https://www.sec.gov/Archives/edgar/data/1730168/000114036123054354/ef20015100_ex99-1.htm |
| 50004 VMware Global Inc. | VMWARE LLC | 549300BUDHS3LRWBE814 | ACTIVE, ISSUED | Broadcom Inc. (relationship period reported from 10 Feb 1998) | 22 Nov 2023 | as above |
| 60003 AVEVA Solutions Ltd | AVEVA SOLUTIONS LIMITED (Cambridge) | 213800B9EV3SYDO3W459 | ACTIVE, ISSUED | Schneider Electric SE (relationship period reported from 7 May 2021) | 1 Mar 2018 (control, about 60 %; the register's date); remaining shares 18 Jan 2023 | AVEVA, "AVEVA announces the completion of its acquisition by Schneider Electric": https://www.aveva.com/en/about/news/press-releases/2023/aveva-announces-the-completion-of-its-acquisition-by-schneider-electric/; Schneider Electric release: https://www.se.com/ww/en/assets/564/document/373415/release-completion-acquisition-aveva.pdf; 2018 combination, completed 1 March 2018 (Schneider Electric's AMF filing of that day: https://echanges.dila.gouv.fr/OPENDATA/AMF/ECO/2018/03/FCECO046056_20180301.pdf; press: https://businesstech.co.za/news/industry-news/230699/completion-of-the-combination-between-schneider-electric-industrial-software-business-and-aveva/) |
| 70002 Slack Technologies Ltd | SLACK TECHNOLOGIES, INC. | 549300VIZRB02KN4IJ45 | ACTIVE, registration LAPSED | none reported | 21 Jul 2021 | Salesforce newsroom: https://www.salesforce.com/au/news/press-releases/2021/07/21/salesforce-slack-deal-close/ |
| 70004 Tableau Software UK | TABLEAU SOFTWARE UK LIMITED | 549300R6ACJWLD7ZNT90 | INACTIVE, RETIRED | none reported | 1 Aug 2019 | Salesforce newsroom, "Salesforce Completes Acquisition of Tableau": https://www.salesforce.com/news/press-releases/2019/08/01/salesforce-completes-acquisition-of-tableau/; investor relations: https://investor.salesforce.com/news/news-details/2019/Salesforce-Completes-Acquisition-of-Tableau/default.aspx |

Subsidiaries in the register (Cisco Systems GmbH, Cisco Technology, Inc., Microsoft Deutschland GmbH, Broadcom Europe Ltd, Schneider Electric GmbH and Ltd, salesforce.com Germany GmbH, Salesforce UK Ltd) carry no LEI in the register. They are real companies; their accounts and spend are invented. One account is invoiced by the parent itself (50001 Broadcom Inc.) and carries the parent's LEI.

**Apex (fictional).** Apex Robotics Holding AG (Esslingen) and Apex Industrial Group plc (Leeds) are two unrelated invented groups. Their accounts, Apex Robotics Solutions GmbH (40001) and Apex Robotics Systems Ltd. (40002), are the Streamlit version's look-alike pair: 66.7 % name similarity (Python's `difflib`), different tax ids, banks and owners. A GLEIF full-text search for "Apex Robotics" returned no record (14 Oct 2026).

### 3.4 Rebate agreements (fictional terms)

The eight agreements are invented. Their clauses follow common patterns of supplier rebate agreements (retroactive tiers on a group's purchases, written claims within a window, look-back clauses, supplier statements, set-off), not any real contract of these suppliers.

| Agreement | Counterparty | Tiers (retroactive) | Claim window | Notes |
|---|---|---|---|---|
| RA-CISCO | Cisco Systems, Inc. and its Affiliates | 2 % from €50.0m | 90 days | Set-off allowed; nothing is paid without a written claim |
| RA-MSFT | Microsoft Corporation and its Affiliates | 2 % from €50.0m | 60 days | Corrections within 15 months (456 days); no set-off |
| RA-APEX | Apex Robotics Solutions GmbH and its affiliates | 1.5 % from €2.0m, 3 % from €4.0m | 80 days | Year-end report lists Apex only from €5.0m |
| RA-AVGO | Broadcom Inc. and its Affiliates | 1 % from €10m, 2 % from €20m, 3 % from €30m | 60 days | Broadcom credits its own statement for the accounts on its record; differences are final after 60 days; no set-off |
| RA-SCHN | Schneider Electric SE and its Affiliates | 2.5 % from €15.0m | 90 days | Counts all GlobalCorp company codes; later claims excluded |
| RA-CRM | Salesforce, Inc. and its Affiliates | 3 % from €20.0m | 90 days | Other currencies at Annex C rates (1 GBP = 1.17 EUR); year-end report counts EUR invoices only |
| RA-CHROMA | Chroma Logistics AG (fictional) | 2 % from €3.0m | 60 days | Credited automatically with the last invoice: a sweep negative |
| RA-OMNI | Omni Consulting Ltd (fictional) | 1.5 % from €4.0m | 90 days | Below its threshold: a sweep negative |

**The year-end rebate report** (fictional, the cause in every scenario): it counts only the accounts linked to an agreement (group key), in the currencies it is set up for, and lists an agreement only above its minimum threshold. A claim is filed only when the report shows one.

**Agreement years.** Each agreement has its own year end, between 37 and 81 days before today; days are relative to today, so the scenarios stay current whenever the app is opened. PY is the year before the last closed year (AY); CY is the running year.

## 4. The six scenarios: what is real

| # | Scenario | Real | Invented |
|---|---|---|---|
| 1 | Cisco acquisitions invoiced on separate accounts | Cisco acquired Meraki (2012), Acacia (2021) and Splunk (2024); GLEIF shows Splunk LLC consolidated by Cisco | The accounts, the €52.4M spend (the Streamlit version's figure), the 2 % agreement, the tip |
| 2 | Microsoft volume incentive and the Activision accounts | Microsoft acquired Activision Blizzard on 13 Oct 2023; GLEIF shows the consolidation | The €47.0M and €51.0M years (the first is the Streamlit version's honest negative), the look-back clause |
| 3 | Look-alike vendors: Apex Robotics | — (both groups are fictional) | Everything; the 66.7 % similarity is computed live from the names |
| 4 | Broadcom rebate statement without VMware | Broadcom acquired VMware on 22 Nov 2023; GLEIF shows both VMware entities consolidated by Broadcom | The accounts, the tiers, the statement |
| 5 | Schneider Electric, AVEVA and a closing claim window | Schneider Electric completed the acquisition of AVEVA's remaining shares on 18 Jan 2023 (majority since 2018); GLEIF shows AVEVA Solutions Limited consolidated by Schneider | The accounts across three company codes, the clause, the window |
| 6 | Salesforce invoices in pounds outside the euro report | Salesforce acquired Slack (2021) and Tableau (2019); today's ECB rate | The pound invoices, the Annex C rate, the euro-only report rule |

### 4.1 Evidence shown in Simulation mode

Scripted replays show representative evidence, labelled "(representative)" in the console and in alert sources, without URLs:
- **Register extracts** are the app's own synthetic register.
- **GLEIF results** are extracts faithful to the records listed in §3.3 as of 14 Oct 2026 (names in GLEIF's own spelling, statuses, parents; relationship dates only where they match the deal).
- **Web results** are the titles of the real announcements in §3.3, with their dates, but no links.
- **ECB rate** values are representative (for example €1 = £0.8668) and labelled so; the live tool reads today's rate.

Recorded live runs keep the real results of the run, labelled "(recorded <date>)".

## 5. Model assumptions (deterministic rebate engine)

All money is calculated by `js/rebate.js` from the data above. Assumptions live in `data/world.js` (`assumptions`) and in each agreement:

| Assumption | Value | Basis |
|---|---|---|
| Tiers | Retroactive: the tier reached applies to all purchases of the year | Common rebate-agreement pattern |
| Exchange rates | Each agreement's fixed contract rate; no rate means EUR only | Clause (fictional) |
| Running year | Projected from the last year by the agreement's growth (2–6 %) | Assumption |
| Claim deadline | End of the agreement year plus the longer of the claim window and the look-back | Clause |
| Person-day for a claim | €1,200 (procurement analyst and legal review) | Assumption, not a market rate |
| Claim preparation | 2–3 days for the last year; 6–10 days for a look-back audit pack | Assumption per agreement |
| Set-off | €400 one-off posting. Every clause allows set-off of undisputed amounts only: the notice goes out on the start day, the supplier has 7 days to object, and the next payment run (2 days) settles it, so cash arrives 9 days after the start (day 12 for a start on day 3); limited by open payables, the rest by credit note | Assumption |
| Credit note | 30–45 days after the claim, per agreement | Assumption |
| Recovery-audit firm | 18 % of the amount recovered, files 35 days after engagement, no fee if it recovers nothing | Assumption; contingency fees are typical for recovery audit |
| Linking accounts (group key, agreement link, report) | €6,000 plus €2,500 per account, effective after 20 days | Assumption |
| Report rule change | €4,000, effective after 15 days | Assumption |
| Horizon | 400 days by default (long enough for the running year's claim) | Design choice |

**Rebate at risk** is the open rebate (owed minus what the supplier credited and what GlobalCorp's report claimed) whose claim deadline falls within the horizon. It includes the running year's projected rebate when the running year's deadline falls within the horizon (the same gap loses it); the do-nothing card shows that part separately. Amounts already past their deadline are reported as *already lost*, never as recoverable.

**Look-back in days.** The Microsoft clause's 15 months are modelled as 456 days; depending on the month lengths a calendar 15 months can be 457. The engine is one day conservative.

## 6. Caveats to mention when presenting

1. **GLEIF relationship periods are not deal dates.** GLEIF reports the period an entity supplied, which can start long before or after an acquisition (VMware International: 2017; Activision Blizzard: 2001). Rebate Hunter returns it as "relationship reported from …" with a note and takes acquisition dates from the register and the acquirer's announcements.
2. **Lapsed and retired LEIs.** Acacia, Activision Blizzard and Slack have LAPSED registrations (not renewed); Tableau Software UK is INACTIVE and RETIRED. Acacia, Slack and Tableau UK report no parent to GLEIF, so GLEIF cannot confirm their owners; the agent then relies on the register and the acquirer's announcement.
3. **Wikidata is crowd-sourced.** It is a lead, never the only source; property P749 is now labelled "parent organization or unit".
4. **ECB rates are reference rates**, published for information, and the Frankfurter v1 API is deprecated (still served). Agreements convert at their own fixed rates whatever the market does.
5. **GLEIF CORS is undocumented.** If the presenter's browser cannot call GLEIF, Diagnostics shows it and the agent uses web search instead.
6. **The numbers are fictional.** No figure describes a real company's purchases or a real agreement; the groups and acquisitions are real.
7. **The headline includes a projection.** In five of the six scenarios about half of the rebate at risk is the current year, projected from last year's spend (the Microsoft correction has no projected part); it is lost only if the gap stays open until that year's deadline. The do-nothing card shows the split.

## 7. What Rebate Hunter does **not** use

- No client data, no SAP or other ERP connection: the ERP tools read the synthetic world in the browser.
- No paid corporate-hierarchy service (such as D&B); the subscription register is synthetic and labelled so.
- No scraping: every live source is a documented public API or Claude's web search.
- No email or posting integration: drafts stay in the outbox.
