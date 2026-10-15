/*
 * REBATE HUNTER — simulation scripts (Simulation mode).
 *
 * One script per preset scenario. Each mirrors what the live agent does: the same tools in the
 * same order, a hypothesis that is checked against the register and a second independent source,
 * a visible "Revised:" self-correction, exactly three costed options plus the do-nothing baseline,
 * drafts that wait for approval, and a management summary.
 *
 * Integrity rules for authors (checked by js/sim_check.js in Diagnostics and tools/check_world.mjs):
 *   - ERP results are produced at playback by the real ERP queries (js/erp.js).
 *   - Every € figure and claim deadline the engine computes comes from the rebate engine via
 *     {{placeholders}} (js/sim_vars.js). An amount may be typed only if a tool returned it earlier
 *     in the script (a tier from erp_get_agreement, an account's spend from erp_list_vendors).
 *   - Web search and open-data results are representative and labelled as such. Web results carry
 *     the titles of the real announcements (DATA_SOURCES.md §3.3) but no links; open-data values
 *     follow the public GLEIF records as checked on 14 October 2026 (DATA_SOURCES.md §3.3).
 *   - The player adds the AI footer to every draft and the mock line to postings, as live mode does.
 *   - Reports end with the simulation marker; nothing here may present itself as a live run.
 *
 * A completed live run can replace a script: "Save run as simulation" in the Audit tab exports it
 * in this format (source: "recorded"), to be appended to the end of this file.
 */
window.SIM_RUNS = {
  "SC-CISCO-MA": {
    title: "Cisco acquisitions invoiced on separate accounts",
    steps: [
      { state: "scanning" },
      { say: "Signal received: a category manager says Meraki and Acacia invoices sit on their own vendor accounts and never count towards the Cisco volume rebate. First question: what does the agreement count, and which of our accounts does it know?" },
      { board: { group_ids: ["G-CISCO"], state: "at_risk" } },
      { tool: "erp_get_agreement", input: { agreement_id: "RA-CISCO" } },
      { say: "Finding: the agreement pays 2 % on all purchases of the year once GlobalCorp buys €50m from Cisco and its affiliates. Only two accounts are linked to it: Cisco Systems Germany (10001) and Cisco Technology (10002)." },
      { tool: "erp_list_vendors", input: { query: "Cisco, Meraki, Acacia" } },
      { say: "Hypothesis: the tip is right. Meraki Cloud Networks (10003) and Acacia Communications Opto (10004) billed €9.5M and €6.2M last year without the Cisco group key, so the year-end report never counted them." },
      { board: { vendor_ids: ["10003", "10004"], link_ids: ["L-10003", "L-10004"], state: "at_risk" } },

      { state: "verifying" },
      { web: {
        query: "Cisco completes acquisition Acacia Communications Meraki",
        summary: "2 results: Cisco's completion announcements for both acquisitions",
        results: [
          { title: "Cisco completes acquisition of Acacia Communications", source: "Cisco newsroom", page_age: "1 March 2021" },
          { title: "Cisco completes acquisition of Meraki", source: "Cisco newsroom", page_age: "20 December 2012" }
        ]
      } },
      { say: "Confirmed: Cisco's own announcements show both deals completed, Meraki in December 2012 and Acacia in March 2021, long before this agreement year began." },

      { state: "diagnosing" },
      { rebate: "hypothesis" },
      { say: "First estimate with Meraki and Acacia counted: the group reaches {{hyp.AY.spend}} in the agreement year, still short of €50m, so nothing would be owed ({{hyp.var}} at risk). Before I accept that, I check who else belongs to Cisco." },

      { state: "verifying" },
      { tool: "erp_family_tree", input: { vendor_id: "10001" } },
      { say: "Check: the subscription register lists five Cisco accounts, not four. Splunk Software EMEA (10005) belongs to Cisco as well: Cisco completed the Splunk acquisition on 18 March 2024, before this agreement year began." },
      { open: "open_gleif_parent", input: { lei: "549300XGDSGBP6UEI867" },
        result: {
          source: "GLEIF Global LEI Index, level 1 and level 2 data (representative extract)",
          entity: { lei: "549300XGDSGBP6UEI867", legal_name: "SPLUNK LLC", legal_address: "WILMINGTON, US", entity_status: "ACTIVE", registration_status: "ISSUED", globalcorp: "register entry of vendor 10005 (Splunk LLC), group G-CISCO" },
          ultimate_parent: { lei: "549300LKFJ962MZ46593", legal_name: "CISCO SYSTEMS, INC.", legal_address: "WILMINGTON, US", entity_status: "ACTIVE", registration_status: "ISSUED", globalcorp: "ultimate parent of register group G-CISCO (Cisco)" },
          relationship: { type: "IS_ULTIMATELY_CONSOLIDATED_BY", status: "ACTIVE", period_start: "2024-03-18" }
        } },
      { say: "Confirmed: the Global LEI Index, an independent public register, shows Splunk LLC as ultimately consolidated by Cisco Systems, Inc., with the relationship reported from 18 March 2024, the day Cisco completed the deal." },
      { say: "Revised: two acquired accounts → three. Meraki, Acacia and Splunk all belong to Cisco: the register says so, and GLEIF and Cisco's own announcements confirm it. The groups and acquisitions are real; GlobalCorp and its accounts are fictional." },
      { alert: {
        title: "Cisco rebate missed: three acquired companies invoiced outside the agreement",
        severity: "high",
        summary: "Meraki, Acacia and Splunk invoice GlobalCorp on their own vendor accounts, without the Cisco group key. Counted with the two linked accounts, the Cisco group crosses the threshold of the 2 % volume rebate.",
        vendor_ids: ["10003", "10004", "10005"],
        group_ids: ["G-CISCO"],
        sources: [
          { title: "Subscription register: Cisco family tree (representative extract)" },
          { title: "GLEIF level-2 record: Splunk LLC ultimately consolidated by Cisco Systems, Inc. (representative)" },
          { title: "Cisco newsroom: Acacia and Meraki acquisitions completed (representative)" }
        ]
      } },

      { state: "diagnosing" },
      { tool: "erp_get_spend", input: { vendor_ids: ["10001", "10002", "10003", "10004", "10005"], agreement_id: "RA-CISCO" } },
      { tool: "erp_get_rebate_report", input: { agreement_id: "RA-CISCO" } },
      { say: "Finding: the ledger confirms the spend of all five accounts, and the year-end report counted only the two linked ones. It stayed below the threshold and filed no claim: the report follows group keys, not the corporate family." },
      { rebate: "finding" },
      { say: "Impact: Cisco owes {{AY.owed_full}} for the agreement year, {{AY.tier}} of {{AY.spend}}. If nothing changes, that claim expires on {{AY.deadline_date}}, in {{AY.deadline_day}} days, and next year's {{CY.open}} slips the same way: {{var}} at risk." },
      { board: { vendor_ids: ["10003", "10004", "10005"], link_ids: ["L-10003", "L-10004", "L-10005"], state: "affected" } },
      { tool: "erp_get_vendor", input: { vendor_id: "10001" } },
      { say: "Response levers: a written claim needs three days of preparation; § 9.1 lets us set the undisputed rebate off against open Cisco invoices once Cisco has had seven days to object; and linking the three accounts in the vendor master takes about 20 days, in time for this year's report." },

      { options: {
        recommended: "V1",
        baseline_description: "The agreement-year claim expires on {{AY.deadline_date}}, and the running year slips the same way.",
        texts: {
          V1: {
            title: "Claim now and link the three accounts",
            description: "Send Cisco a written claim for the agreement year, and set the Cisco group key on Meraki, Acacia and Splunk so the year-end report counts them from now on.",
            residual_risk: "Cisco may ask for invoice evidence per account; the credit note takes about 45 days."
          },
          V2: {
            title: "Set off against open Cisco invoices",
            description: "Notify Cisco of the claim and, unless Cisco objects within seven days, deduct it from open Cisco invoices in the next payment run; link the three accounts as in option A.",
            residual_risk: "A set-off before Cisco agrees can strain the account relationship."
          },
          V3: {
            title: "Claim the agreement year only",
            description: "Send the written claim, but leave the vendor master as it is.",
            residual_risk: "Next year's rebate slips in exactly the same way."
          }
        }
      } },
      { say: "Recommendation: option A. It recovers {{V1.rec}} for {{V1.cost}} and leaves nothing lost, the lowest expected total. Option B costs {{V2.cost}} but brings the cash in on day {{V2.time}} instead of day {{V1.time}}." },

      { awaitOption: {
        rejected: {
          V1: "Option A rejected. Options B and C remain: B collects the same rebate by set-off, C claims the agreement year without fixing the master data.",
          V2: "Option B rejected. Option A recovers the same amount by credit note; option C claims without the master-data fix.",
          V3: "Option C rejected. Options A and B both recover the full {{var}}."
        },
        approved: {
          V1: [
            { state: "executing" },
            { say: "Option A approved. Drafting the claim letter to Cisco and the vendor-master change for the three accounts. Each draft waits for your approval in the Outbox; nothing is sent." },
            { draft: {
              type: "email", recipient: "Cisco Systems, Inc., Global Rebates team",
              subject: "Volume rebate claim for the agreement year {{AY.period}}: {{AY.owed_full}}",
              body: "Dear Global Rebates team,\n\nUnder § 4.2 of our volume rebate agreement, Cisco credits 2 % of all net purchases of an agreement year once GlobalCorp's purchases from Cisco Systems, Inc. and its Affiliates reach €50.0m.\n\nIn the agreement year {{AY.period}} our purchases from Cisco and its Affiliates totalled {{AY.spend_full}}. This includes the invoices of Meraki (part of Cisco since 20 December 2012), Acacia Communications (since 1 March 2021) and Splunk (since 18 March 2024), which reach us on separate accounts.\n\nWe therefore claim a rebate of {{AY.owed_full}} and ask for a credit note. An account statement with every invoice is attached to this claim.\n\nPlease confirm by {{date:+14}}. The claim period under § 4.5 ends on {{AY.deadline_date}}.\n\nKind regards\nProcurement Controlling\nGlobalCorp SE"
            } },
            { draft: {
              type: "memo", recipient: "Master Data Management, GlobalCorp SE",
              subject: "Set group key CISCO on vendor accounts 10003, 10004 and 10005",
              body: "Request: maintain the group key CISCO (vendor master field KONZS) on these accounts and link them to agreement RA-CISCO:\n- 10003 Meraki Cloud Networks Ltd.\n- 10004 Acacia Communications Opto\n- 10005 Splunk Software EMEA\n\nWhy: the subscription register lists all three as Cisco companies. Without the link the year-end report misses their spend, and this year's rebate of {{CY.open}} would slip like the last one.\n\nPlease complete within 20 days and confirm to Procurement Controlling."
            } },
            { board: { vendor_ids: ["10003", "10004", "10005"], link_ids: ["L-10003", "L-10004", "L-10005"], state: "resolved" } },
            { awaitActions: true },
            { report: "## Cisco: rebate decision\n\n**What we found.** Meraki, Acacia and Splunk invoice GlobalCorp on their own vendor accounts without the Cisco group key. The subscription register lists all three as Cisco companies, confirmed by GLEIF and Cisco's announcements. Counted together, the Cisco group bought {{AY.spend}} in the agreement year and crossed the 2 % threshold.\n\n**If we do nothing.** The claim of {{AY.owed}} expires on {{AY.deadline_date}}, and the running year slips the same way: **{{var}}** lost.\n\n**Decision.** Option A approved: a written claim now, and the three accounts linked to the agreement.\n\n| | Do nothing | Option A |\n|---|---|---|\n| Response cost | – | {{V1.cost}} |\n| Rebate still lost | {{var}} | {{V1.res}} |\n| Expected total | {{var}} | {{V1.total}} |\n\n**Actions.** {{actions.approved}} of {{actions.total}} drafts approved in the outbox. They are drafts: nothing was sent.\n\n**Residual risk.** Cisco may ask for evidence per account before it issues the credit note.\n\n**How we know.** Accounts and spend from the vendor master and ledger; membership from the subscription register, GLEIF and Cisco's announcements; every euro figure from the deterministic rebate engine.\n\n*Simulated run (scripted replay). Figures calculated by the rebate engine from the synthetic company.*" },
            { end: "done" }
          ],
          V2: [
            { state: "executing" },
            { say: "Option B approved. Drafting the set-off notice to Cisco, the set-off posting and the vendor-master change; each draft waits for your approval in the Outbox." },
            { draft: {
              type: "email", recipient: "Cisco Systems, Inc., Global Rebates team",
              subject: "Notice of set-off: volume rebate {{AY.period}}, {{AY.owed_full}}",
              body: "Dear Global Rebates team,\n\nIn the agreement year {{AY.period}} GlobalCorp's purchases from Cisco Systems, Inc. and its Affiliates reached {{AY.spend_full}}, including Meraki, Acacia and Splunk. Under § 4.2 a rebate of {{AY.owed_full}} is due.\n\nAs § 9.1 allows, we will set this amount off against open Cisco invoices in the first payment run after {{V2.objection_date}}. A statement of the invoices concerned follows with the remittance advice.\n\nPlease raise any objection by {{V2.objection_date}}.\n\nKind regards\nProcurement Controlling\nGlobalCorp SE"
            } },
            { draft: {
              type: "posting", recipient: "Accounts Payable, GlobalCorp SE (company code CC-1000)",
              subject: "Set-off posting: Cisco volume rebate {{AY.period}}",
              body: "Company code: CC-1000 GlobalCorp SE\nVendor: 10001 Cisco Systems Germany GmbH (open invoices of the Cisco group)\nAmount: {{AY.owed_full}} credit against open invoices\nReference: RA-CISCO § 4.2 and § 9.1, agreement year {{AY.period}}\nPayment run: first run after {{V2.objection_date}} (end of the objection period)"
            } },
            { draft: {
              type: "memo", recipient: "Master Data Management, GlobalCorp SE",
              subject: "Set group key CISCO on vendor accounts 10003, 10004 and 10005",
              body: "Request: maintain the group key CISCO (vendor master field KONZS) on 10003 Meraki, 10004 Acacia and 10005 Splunk, and link them to agreement RA-CISCO. The register lists all three as Cisco companies. Please complete within 20 days."
            } },
            { board: { vendor_ids: ["10003", "10004", "10005"], link_ids: ["L-10003", "L-10004", "L-10005"], state: "resolved" } },
            { awaitActions: true },
            { report: "## Cisco: rebate decision\n\n**What we found.** Meraki, Acacia and Splunk invoice GlobalCorp outside the Cisco agreement; the register, GLEIF and Cisco's announcements confirm they are Cisco companies. Together the group crossed the 2 % threshold.\n\n**If we do nothing.** **{{var}}** lost: the agreement-year claim expires on {{AY.deadline_date}}, and the running year slips too.\n\n**Decision.** Option B approved: set-off against open Cisco invoices, and the three accounts linked. Response cost {{V2.cost}}; rebate still lost {{V2.res}}; expected total {{V2.total}}; cash on day {{V2.time}}.\n\n**Actions.** {{actions.approved}} of {{actions.total}} drafts approved in the outbox (drafts only, nothing sent or posted).\n\n**Residual risk.** A set-off before Cisco confirms can strain the relationship.\n\n*Simulated run (scripted replay). Figures calculated by the rebate engine from the synthetic company.*" },
            { end: "done" }
          ],
          V3: [
            { state: "executing" },
            { say: "Option C approved. Drafting the claim letter to Cisco; the vendor master stays as it is. The draft waits for your approval in the Outbox." },
            { draft: {
              type: "email", recipient: "Cisco Systems, Inc., Global Rebates team",
              subject: "Volume rebate claim for the agreement year {{AY.period}}: {{AY.owed_full}}",
              body: "Dear Global Rebates team,\n\nIn the agreement year {{AY.period}} GlobalCorp's purchases from Cisco Systems, Inc. and its Affiliates, including Meraki, Acacia and Splunk, totalled {{AY.spend_full}}. Under § 4.2 we claim a rebate of {{AY.owed_full}} and ask for a credit note.\n\nPlease confirm by {{date:+14}}; the claim period ends on {{AY.deadline_date}}.\n\nKind regards\nProcurement Controlling\nGlobalCorp SE"
            } },
            { awaitActions: true },
            { report: "## Cisco: rebate decision\n\n**What we found.** Three Cisco companies invoice GlobalCorp outside the Cisco agreement; with them the group crossed the 2 % threshold.\n\n**If we do nothing.** **{{var}}** lost.\n\n**Decision.** Option C approved: claim the agreement year only. Response cost {{V3.cost}}; rebate still lost {{V3.res}}; expected total {{V3.total}}.\n\n**Actions.** {{actions.approved}} of {{actions.total}} drafts approved (drafts only, nothing sent).\n\n**Residual risk.** The accounts stay unlinked, so the running year's rebate of {{CY.open}} slips unless the master data is fixed before the year ends.\n\n*Simulated run (scripted replay). Figures calculated by the rebate engine from the synthetic company.*" },
            { end: "done" }
          ],
          baseline: [
            { state: "executing" },
            { say: "Loss accepted. I will not contact Cisco. Drafting an internal memo that records the decision." },
            { draft: {
              type: "memo", recipient: "Procurement Controlling, GlobalCorp SE",
              subject: "Cisco rebate not claimed: decision recorded",
              body: "Decision: no claim under the Cisco volume rebate agreement for {{AY.period}}.\n\nWhat this means\n- The agreement-year rebate of {{AY.owed_full}} lapses on {{AY.deadline_date}}\n- Without linking Meraki, Acacia and Splunk, the running year's {{CY.open}} lapses as well\n- Total not recovered within the horizon: {{var}}\n\nPlease file this note with the year-end rebate report."
            } },
            { awaitActions: true },
            { report: "## Cisco: loss accepted\n\n**What we found.** Three Cisco companies invoice GlobalCorp outside the agreement; the group crossed the 2 % threshold.\n\n**Decision.** Do nothing; the loss is accepted. Not recovered within the horizon: **{{var}}**, the first claim lapsing on {{AY.deadline_date}}.\n\n**Actions.** {{actions.approved}} of {{actions.total}} internal notes approved.\n\n*Simulated run (scripted replay). Figures calculated by the rebate engine from the synthetic company.*" },
            { end: "done" }
          ]
        }
      } }
    ]
  },

  "SC-MSFT-PY": {
    title: "Microsoft volume incentive and the Activision accounts",
    steps: [
      { state: "scanning" },
      { say: "Signal received: the licence team says Activision Blizzard belongs to Microsoft, but its invoices sit on a separate vendor account. First question: what does the Microsoft agreement pay, and when can it still be claimed?" },
      { board: { group_ids: ["G-MSFT"], state: "at_risk" } },
      { tool: "erp_get_agreement", input: { agreement_id: "RA-MSFT" } },
      { say: "Finding: the volume incentive pays 2 % on all purchases of a year once Microsoft and its affiliates reach €50m. Only Microsoft Deutschland (20001) is linked, and § 11.3 lets us claim missed rebates for 15 months after a year ends." },
      { tool: "erp_list_vendors", input: { query: "Microsoft, Activision" } },
      { say: "Hypothesis: Activision Blizzard Germany (20002) lifts this agreement year over the threshold. Microsoft Deutschland billed €41.0M and Activision €6.0M in the last agreement year." },
      { board: { vendor_ids: ["20002"], link_ids: ["L-20002"], state: "at_risk" } },

      { state: "verifying" },
      { web: {
        query: "Microsoft completes acquisition of Activision Blizzard",
        summary: "1 result: Microsoft's completion announcement",
        results: [
          { title: "Welcoming the legendary teams at Activision Blizzard King to Team Xbox", source: "Official Microsoft Blog", page_age: "13 October 2023" }
        ]
      } },
      { say: "Check: Microsoft completed the Activision Blizzard acquisition on 13 October 2023, so its invoices count for every agreement year that began after that day." },

      { state: "diagnosing" },
      { rebate: "hypothesis" },
      { say: "First estimate for this agreement year: the group reaches {{hyp.AY.spend}}, short of €50m, so nothing is owed for it ({{hyp.var}}). That is an honest negative. The look-back clause makes me check the year before as well." },

      { state: "verifying" },
      { tool: "erp_family_tree", input: { vendor_id: "20002" } },
      { open: "open_gleif_parent", input: { lei: "549300TPQQDBP9GNOF40" },
        result: {
          source: "GLEIF Global LEI Index, level 1 and level 2 data (representative extract)",
          entity: { lei: "549300TPQQDBP9GNOF40", legal_name: "ACTIVISION BLIZZARD, INC.", legal_address: "WILMINGTON, US", entity_status: "ACTIVE", registration_status: "LAPSED", globalcorp: "register entry of vendor 20002 (Activision Blizzard, Inc.), group G-MSFT" },
          ultimate_parent: { lei: "INR2EJN1ERAN0W5ZP974", legal_name: "MICROSOFT CORPORATION", entity_status: "ACTIVE", registration_status: "ISSUED", globalcorp: "ultimate parent of register group G-MSFT (Microsoft)" },
          relationship: { type: "IS_ULTIMATELY_CONSOLIDATED_BY", status: "ACTIVE" }
        } },
      { say: "Confirmed: the register lists Activision Blizzard as part of Microsoft since 13 October 2023, and GLEIF shows Activision Blizzard, Inc. as ultimately consolidated by Microsoft Corporation." },
      { tool: "erp_get_spend", input: { vendor_ids: ["20001", "20002"], agreement_id: "RA-MSFT" } },
      { say: "Revised: a claim for this year → a look-back claim for the year before. In the previous agreement year both accounts billed more, that year began after the acquisition, and § 11.3 still covers it." },
      { alert: {
        title: "Microsoft volume incentive missed for the previous year",
        severity: "high",
        summary: "Activision Blizzard invoices GlobalCorp on its own account, so the year-end report never counted it. With Activision, the previous agreement year crossed Microsoft's 2 % threshold, and the 15-month look-back clause still allows the claim.",
        vendor_ids: ["20002"],
        group_ids: ["G-MSFT"],
        sources: [
          { title: "Subscription register: Microsoft family tree (representative extract)" },
          { title: "GLEIF level-2 record: Activision Blizzard, Inc. ultimately consolidated by Microsoft Corporation (representative)" },
          { title: "Microsoft enterprise agreement § 11.3, look-back clause (ERP)" }
        ]
      } },

      { state: "diagnosing" },
      { tool: "erp_get_rebate_report", input: { agreement_id: "RA-MSFT" } },
      { rebate: "finding" },
      { say: "Impact: for the previous agreement year Microsoft owes {{PY.owed_full}}, {{PY.tier}} of {{PY.spend}}. The look-back window closes on {{PY.deadline_date}}, in {{PY.deadline_day}} days; the agreement year just closed stays below the threshold." },
      { board: { vendor_ids: ["20002"], link_ids: ["L-20002"], state: "affected" } },
      { say: "Response levers: Microsoft allows no set-off, so the money comes by credit note. A look-back claim needs an audit pack of about ten person-days; a recovery-audit firm would do it on contingency but needs about 35 days." },

      { options: {
        recommended: "V1",
        baseline_description: "The look-back window for the previous year closes on {{PY.deadline_date}}.",
        texts: {
          V1: {
            title: "Claim the previous year ourselves",
            description: "Prepare the audit pack in-house and file the § 11.3 look-back claim within ten days.",
            residual_risk: "Microsoft may contest the Activision invoices; the audit pack must show each one."
          },
          V2: {
            title: "Hand the claim to a recovery-audit firm",
            description: "Engage a recovery-audit firm on contingency to prepare and file the look-back claim.",
            residual_risk: "The firm files only a few days before the window closes, and keeps a share of the money."
          },
          V3: {
            title: "Claim the previous year and link Activision",
            description: "File the look-back claim as in option A, and set the Microsoft group key on the Activision account.",
            residual_risk: "Costs more within the horizon and recovers nothing extra this year, but stops the next threshold year from slipping."
          }
        }
      } },
      { say: "Recommendation: option A. It recovers {{V1.rec}} for {{V1.cost}} of internal work. The audit firm in option B would cost {{V2.cost}} and file with little time to spare; option C adds the master-data fix for {{V3.cost}} in total, worth it if Microsoft spend keeps growing." },

      { awaitOption: {
        rejected: {
          V1: "Option A rejected. Option B hands the claim to an audit firm; option C files it ourselves and fixes the master data.",
          V2: "Option B rejected. Options A and C file the claim ourselves.",
          V3: "Option C rejected. Option A files the same claim without the master-data change."
        },
        approved: {
          V1: [
            { state: "executing" },
            { say: "Option A approved. Drafting the look-back claim to Microsoft and the request for the audit pack. Each draft waits for your approval in the Outbox; nothing is sent." },
            { draft: {
              type: "email", recipient: "Microsoft Corporation, Enterprise Agreement desk",
              subject: "Look-back claim under § 11.3 for the agreement year {{PY.period}}: {{PY.owed_full}}",
              body: "Dear Enterprise Agreement team,\n\nUnder § 6.1 of our enterprise agreement, Microsoft credits 2 % of all purchases of an agreement year once GlobalCorp's purchases from Microsoft Corporation and its Affiliates reach €50.0m. § 11.3 allows undisclosed rebates to be claimed within 15 months after the end of the agreement year.\n\nIn the agreement year {{PY.period}} our purchases from Microsoft and its Affiliates totalled {{PY.spend_full}}, including Activision Blizzard (part of Microsoft since 13 October 2023), which invoices us on a separate account.\n\nWe therefore claim {{PY.owed_full}} and ask for a credit note. The audit pack with every invoice follows within ten days.\n\nPlease confirm receipt by {{date:+14}}. The look-back period ends on {{PY.deadline_date}}.\n\nKind regards\nProcurement Controlling\nGlobalCorp SE"
            } },
            { draft: {
              type: "memo", recipient: "Procurement Controlling, audit team",
              subject: "Audit pack for the Microsoft look-back claim, agreement year {{PY.period}}",
              body: "Please compile, within ten days, every invoice of vendor accounts 20001 Microsoft Deutschland GmbH and 20002 Activision Blizzard Germany for the agreement year {{PY.period}}, with the register extract showing Activision as a Microsoft company.\n\nThe claim of {{PY.owed_full}} must reach Microsoft by {{PY.deadline_date}}."
            } },
            { board: { vendor_ids: ["20002"], link_ids: ["L-20002"], state: "resolved" } },
            { awaitActions: true },
            { report: "## Microsoft: rebate decision\n\n**What we found.** Activision Blizzard invoices GlobalCorp on its own account, so the year-end report never counted it. The agreement year just closed stays below the €50m threshold, an honest negative. The previous year crossed it, and the 15-month look-back clause still covers it.\n\n**If we do nothing.** The look-back window closes on {{PY.deadline_date}}: **{{var}}** lost.\n\n**Decision.** Option A approved: file the look-back claim ourselves.\n\n| | Do nothing | Option A |\n|---|---|---|\n| Response cost | – | {{V1.cost}} |\n| Rebate still lost | {{var}} | {{V1.res}} |\n| Expected total | {{var}} | {{V1.total}} |\n\n**Actions.** {{actions.approved}} of {{actions.total}} drafts approved in the outbox. They are drafts: nothing was sent.\n\n**Residual risk.** Microsoft may contest individual Activision invoices.\n\n**How we know.** Clause and spend from the ERP and ledger; membership from the register, GLEIF and Microsoft's announcement; every euro figure from the deterministic rebate engine.\n\n*Simulated run (scripted replay). Figures calculated by the rebate engine from the synthetic company.*" },
            { end: "done" }
          ],
          V2: [
            { state: "executing" },
            { say: "Option B approved. Drafting the engagement letter for the recovery-audit firm; it waits for your approval in the Outbox." },
            { draft: {
              type: "email", recipient: "Contracted recovery-audit firm, rebate recovery practice",
              subject: "Engagement: Microsoft look-back claim, agreement year {{PY.period}}",
              body: "Dear recovery team,\n\nWe would like to engage you on contingency to prepare and file a look-back claim under § 11.3 of our Microsoft enterprise agreement for the agreement year {{PY.period}}.\n\nScope\n- Vendor accounts 20001 Microsoft Deutschland GmbH and 20002 Activision Blizzard Germany\n- Claim amount according to our analysis: {{PY.owed_full}}\n- The look-back period ends on {{PY.deadline_date}}; the claim must reach Microsoft before then\n\nPlease confirm the engagement and your filing date by {{date:+3}}.\n\nKind regards\nProcurement Controlling\nGlobalCorp SE"
            } },
            { awaitActions: true },
            { report: "## Microsoft: rebate decision\n\n**What we found.** The previous agreement year crossed Microsoft's 2 % threshold once Activision is counted; the look-back clause still covers it.\n\n**If we do nothing.** **{{var}}** lost on {{PY.deadline_date}}.\n\n**Decision.** Option B approved: a recovery-audit firm files the claim. Response cost {{V2.cost}}; rebate still lost {{V2.res}}; expected total {{V2.total}}; cash on day {{V2.time}}.\n\n**Actions.** {{actions.approved}} of {{actions.total}} drafts approved (drafts only, nothing sent).\n\n**Residual risk.** The firm files only a few days before the window closes.\n\n*Simulated run (scripted replay). Figures calculated by the rebate engine from the synthetic company.*" },
            { end: "done" }
          ],
          V3: [
            { state: "executing" },
            { say: "Option C approved. Drafting the look-back claim and the vendor-master change for Activision; each draft waits for your approval in the Outbox." },
            { draft: {
              type: "email", recipient: "Microsoft Corporation, Enterprise Agreement desk",
              subject: "Look-back claim under § 11.3 for the agreement year {{PY.period}}: {{PY.owed_full}}",
              body: "Dear Enterprise Agreement team,\n\nIn the agreement year {{PY.period}} GlobalCorp's purchases from Microsoft and its Affiliates, including Activision Blizzard, totalled {{PY.spend_full}}. Under § 6.1 and § 11.3 we claim {{PY.owed_full}} and ask for a credit note.\n\nPlease confirm receipt by {{date:+14}}; the look-back period ends on {{PY.deadline_date}}.\n\nKind regards\nProcurement Controlling\nGlobalCorp SE"
            } },
            { draft: {
              type: "memo", recipient: "Master Data Management, GlobalCorp SE",
              subject: "Set group key MICROSOFT on vendor account 20002",
              body: "Request: maintain the group key MICROSOFT (KONZS) on 20002 Activision Blizzard Germany and link it to agreement RA-MSFT. The register lists Activision as a Microsoft company since 13 October 2023. Please complete within 20 days."
            } },
            { board: { vendor_ids: ["20002"], link_ids: ["L-20002"], state: "resolved" } },
            { awaitActions: true },
            { report: "## Microsoft: rebate decision\n\n**What we found.** Activision Blizzard is a Microsoft company invoiced outside the agreement; the previous year crossed the threshold.\n\n**If we do nothing.** **{{var}}** lost on {{PY.deadline_date}}.\n\n**Decision.** Option C approved: claim the previous year and link Activision. Response cost {{V3.cost}}; rebate still lost {{V3.res}}; expected total {{V3.total}}.\n\n**Actions.** {{actions.approved}} of {{actions.total}} drafts approved (drafts only, nothing sent).\n\n**Residual risk.** None within the horizon; the link protects future threshold years.\n\n*Simulated run (scripted replay). Figures calculated by the rebate engine from the synthetic company.*" },
            { end: "done" }
          ],
          baseline: [
            { state: "executing" },
            { say: "Loss accepted. I will not contact Microsoft. Drafting an internal memo that records the decision." },
            { draft: {
              type: "memo", recipient: "Procurement Controlling, GlobalCorp SE",
              subject: "Microsoft look-back claim not filed: decision recorded",
              body: "Decision: no look-back claim under § 11.3 for the agreement year {{PY.period}}.\n\nThe rebate of {{PY.owed_full}} lapses on {{PY.deadline_date}}. Please file this note with the year-end rebate report."
            } },
            { awaitActions: true },
            { report: "## Microsoft: loss accepted\n\n**What we found.** The previous year crossed Microsoft's 2 % threshold once Activision is counted.\n\n**Decision.** Do nothing; the loss is accepted. Not recovered: **{{var}}**, lapsing on {{PY.deadline_date}}.\n\n**Actions.** {{actions.approved}} of {{actions.total}} internal notes approved.\n\n*Simulated run (scripted replay). Figures calculated by the rebate engine from the synthetic company.*" },
            { end: "done" }
          ]
        }
      } }
    ]
  },

  "SC-APEX-NAME": {
    title: "Look-alike vendors: Apex Robotics",
    steps: [
      { state: "scanning" },
      { say: "Signal received: the duplicate-vendor check says Apex Robotics Solutions GmbH and Apex Robotics Systems Ltd. look like one supplier. First question: are they one company, or two that only sound alike?" },
      { board: { vendor_ids: ["40001", "40002"], state: "at_risk" } },
      { tool: "erp_find_duplicates", input: { vendor_id: "40001" } },
      { say: "Hypothesis: one supplier with two accounts. The names are 66.7 % alike, but the same check also flags three unrelated robotics firms above its 60 % rule, which shows how loose a name match is." },
      { tool: "erp_get_agreement", input: { agreement_id: "RA-APEX" } },

      { state: "verifying" },
      { tool: "erp_family_tree", input: { vendor_id: "40001" } },
      { say: "Check: the register puts Apex Robotics Solutions (40001) under Apex Robotics Holding AG in Esslingen. Before I look up the other account, I size what the duplicate check claims." },

      { state: "diagnosing" },
      { rebate: "hypothesis" },
      { say: "What-if, not verified: counted as one supplier, the two accounts would reach {{hyp.AY.spend}} and the {{hyp.AY.tier}} tier, {{hyp.AY.owed}} for the agreement year. That only holds if they belong together." },

      { state: "verifying" },
      { tool: "erp_family_tree", input: { vendor_id: "40002" } },
      { open: "open_gleif_search", input: { name: "Apex Robotics" },
        result: {
          source: "GLEIF Global LEI Index, level 1 and level 2 data (representative extract)",
          query: "Apex Robotics", total: 0, records: [],
          note: "No GLEIF record matches this name. Fictional companies, and many small firms, have no LEI."
        } },
      { say: "Not confirmed: the register puts Apex Robotics Solutions under Apex Robotics Holding AG in Germany and Apex Robotics Systems under Apex Industrial Group plc in the UK, with different tax ids and banks. GLEIF has no record of either, so nothing supports a merge." },
      { say: "Revised: one supplier with two accounts → two unrelated companies. Apex Robotics Systems (40002) stays out: merging them would claim a bonus on another company's purchases." },
      { board: { vendor_ids: ["40002"], state: "neutral" } },
      { tool: "erp_get_rebate_report", input: { agreement_id: "RA-APEX" } },
      { say: "Confirmed: on its own, Apex Robotics Solutions still earned the 1.5 % tier, which starts at €2m. The year-end report lists Apex only from €5m, so the smaller bonus was never claimed." },
      { alert: {
        title: "Apex volume bonus missed: the report hides the first tier",
        severity: "medium",
        summary: "Apex Robotics Solutions reached the 1.5 % volume-bonus tier on its own, but the year-end report lists the agreement only from €5m, so no claim was filed. The look-alike account belongs to another group and stays out.",
        vendor_ids: ["40001"],
        group_ids: ["G-APEX-DE"],
        sources: [
          { title: "Apex framework agreement § 5, volume-bonus tiers (ERP)" },
          { title: "Year-end rebate report for Apex (ERP)" },
          { title: "Subscription register: two separate Apex groups (representative extract)" }
        ]
      } },

      { state: "diagnosing" },
      { tool: "erp_get_vendor", input: { vendor_id: "40001" } },
      { rebate: "finding" },
      { say: "Impact: Apex owes {{AY.owed_full}} for the agreement year, {{AY.tier}} of {{AY.spend}}, and the claim window closes on {{AY.deadline_date}}, in {{AY.deadline_day}} days. Next year's {{CY.open}} slips the same way unless the report rule changes: {{var}} at risk." },
      { board: { vendor_ids: ["40001"], link_ids: ["L-40001"], state: "affected" } },
      { say: "Response levers: two days to prepare a claim; § 7 allows set-off against open Apex invoices; a change request removes the report's €5m floor within about 15 days." },

      { options: {
        recommended: "V1",
        baseline_description: "The bonus lapses on {{AY.deadline_date}}, and next year's bonus stays hidden by the report.",
        texts: {
          V1: {
            title: "Claim the bonus and fix the report",
            description: "Send Apex a written claim for the 1.5 % bonus, and have the year-end report list every tier reached.",
            residual_risk: "Apex may question the tier until it reconciles its own invoices."
          },
          V2: {
            title: "Set off the bonus and fix the report",
            description: "Notify Apex and, unless Apex objects within seven days, deduct the bonus from open Apex invoices in the next payment run; fix the report as in option A.",
            residual_risk: "A set-off on a small supplier account can sour a good relationship."
          },
          V3: {
            title: "Claim the bonus only",
            description: "Send the written claim and leave the report rule unchanged.",
            residual_risk: "Next year's bonus stays invisible to the report."
          }
        }
      } },
      { say: "Recommendation: option A. It recovers {{V1.rec}} for {{V1.cost}}, the claim plus the report fix. Option B brings the cash in on day {{V2.time}} for {{V2.cost}}." },

      { awaitOption: {
        rejected: {
          V1: "Option A rejected. Options B and C remain: B collects by set-off, C claims without fixing the report.",
          V2: "Option B rejected. Option A collects the same bonus by credit note.",
          V3: "Option C rejected. Options A and B also fix the report rule."
        },
        approved: {
          V1: [
            { state: "executing" },
            { say: "Option A approved. Drafting the bonus claim to Apex Robotics Solutions and the report change request. Each draft waits for your approval in the Outbox; nothing is sent." },
            { draft: {
              type: "email", recipient: "Apex Robotics Solutions GmbH, key account management",
              subject: "Volume bonus claim for the agreement year {{AY.period}}: {{AY.owed_full}}",
              body: "Dear key account team,\n\nUnder § 5 of our framework agreement, Apex grants a volume bonus of 1.5 % on all purchases of an agreement year from €2.0m.\n\nIn the agreement year {{AY.period}} our purchases from Apex Robotics Solutions GmbH totalled {{AY.spend_full}}. We therefore claim a bonus of {{AY.owed_full}} and ask for a credit note.\n\nPlease confirm by {{date:+7}}. Claims under § 5.4 must reach you by {{AY.deadline_date}}.\n\nKind regards\nProcurement Controlling\nGlobalCorp SE"
            } },
            { draft: {
              type: "memo", recipient: "Procurement reporting team, GlobalCorp SE",
              subject: "Change request: year-end rebate report to list every tier reached",
              body: "Request: remove the minimum of €5.0m in the year-end rebate report, so that every agreement is listed as soon as it reaches its first tier.\n\nWhy: Apex Robotics Solutions reached the 1.5 % tier of the Apex agreement, but the report did not list it, and the bonus of {{AY.owed_full}} was never claimed. Next year's {{CY.open}} would be missed the same way.\n\nPlease implement within 15 days."
            } },
            { board: { vendor_ids: ["40001"], link_ids: ["L-40001"], state: "resolved" } },
            { awaitActions: true },
            { report: "## Apex: rebate decision\n\n**What we found.** The duplicate check's look-alike pair are two unrelated companies: the register puts them in different groups, and GLEIF knows neither. Apex Robotics Solutions alone reached the 1.5 % volume-bonus tier, but the year-end report lists Apex only from €5m.\n\n**If we do nothing.** The bonus of {{AY.owed}} lapses on {{AY.deadline_date}}, and next year's stays hidden: **{{var}}** lost.\n\n**Decision.** Option A approved: claim the bonus and fix the report rule.\n\n| | Do nothing | Option A |\n|---|---|---|\n| Response cost | – | {{V1.cost}} |\n| Rebate still lost | {{var}} | {{V1.res}} |\n| Expected total | {{var}} | {{V1.total}} |\n\n**Actions.** {{actions.approved}} of {{actions.total}} drafts approved in the outbox. They are drafts: nothing was sent.\n\n**Avoided.** Merging the look-alike would have claimed the 3 % tier on another company's purchases; that claim was not made.\n\n**Residual risk.** Apex may question the tier until it reconciles its own invoices.\n\n**How we know.** The duplicate check, the register and GLEIF for the companies; clause, ledger and report from the ERP; every euro figure from the deterministic rebate engine.\n\n*Simulated run (scripted replay). Figures calculated by the rebate engine from the synthetic company.*" },
            { end: "done" }
          ],
          V2: [
            { state: "executing" },
            { say: "Option B approved. Drafting the set-off notice, the posting and the report change request; each draft waits for your approval in the Outbox." },
            { draft: {
              type: "email", recipient: "Apex Robotics Solutions GmbH, key account management",
              subject: "Notice of set-off: volume bonus {{AY.period}}, {{AY.owed_full}}",
              body: "Dear key account team,\n\nIn the agreement year {{AY.period}} our purchases from Apex Robotics Solutions GmbH reached {{AY.spend_full}}, so a volume bonus of {{AY.owed_full}} is due under § 5. As § 7 allows, we will set it off against your open invoices in the first payment run after {{V2.objection_date}}.\n\nPlease raise any objection by {{V2.objection_date}}.\n\nKind regards\nProcurement Controlling\nGlobalCorp SE"
            } },
            { draft: {
              type: "posting", recipient: "Accounts Payable, GlobalCorp SE (company code CC-1000)",
              subject: "Set-off posting: Apex volume bonus {{AY.period}}",
              body: "Company code: CC-1000 GlobalCorp SE\nVendor: 40001 Apex Robotics Solutions GmbH\nAmount: {{AY.owed_full}} credit against open invoices\nReference: RA-APEX § 5 and § 7, agreement year {{AY.period}}\nPayment run: first run after {{V2.objection_date}} (end of the objection period)"
            } },
            { draft: {
              type: "memo", recipient: "Procurement reporting team, GlobalCorp SE",
              subject: "Change request: year-end rebate report to list every tier reached",
              body: "Request: remove the report's €5.0m minimum so every agreement is listed from its first tier. Please implement within 15 days."
            } },
            { board: { vendor_ids: ["40001"], link_ids: ["L-40001"], state: "resolved" } },
            { awaitActions: true },
            { report: "## Apex: rebate decision\n\n**What we found.** The look-alike accounts are two unrelated companies. Apex Robotics Solutions alone reached the 1.5 % tier, hidden by the report's €5m floor.\n\n**If we do nothing.** **{{var}}** lost.\n\n**Decision.** Option B approved: set off the bonus and fix the report. Response cost {{V2.cost}}; rebate still lost {{V2.res}}; expected total {{V2.total}}; cash on day {{V2.time}}.\n\n**Actions.** {{actions.approved}} of {{actions.total}} drafts approved (drafts only, nothing sent or posted).\n\n*Simulated run (scripted replay). Figures calculated by the rebate engine from the synthetic company.*" },
            { end: "done" }
          ],
          V3: [
            { state: "executing" },
            { say: "Option C approved. Drafting the bonus claim; the report rule stays as it is. The draft waits for your approval in the Outbox." },
            { draft: {
              type: "email", recipient: "Apex Robotics Solutions GmbH, key account management",
              subject: "Volume bonus claim for the agreement year {{AY.period}}: {{AY.owed_full}}",
              body: "Dear key account team,\n\nIn the agreement year {{AY.period}} our purchases from Apex Robotics Solutions GmbH totalled {{AY.spend_full}}. Under § 5 we claim a volume bonus of {{AY.owed_full}} and ask for a credit note.\n\nPlease confirm by {{date:+7}}; claims must reach you by {{AY.deadline_date}}.\n\nKind regards\nProcurement Controlling\nGlobalCorp SE"
            } },
            { awaitActions: true },
            { report: "## Apex: rebate decision\n\n**What we found.** Apex Robotics Solutions alone reached the 1.5 % tier; the look-alike is another company and stays out.\n\n**If we do nothing.** **{{var}}** lost.\n\n**Decision.** Option C approved: claim the bonus only. Response cost {{V3.cost}}; rebate still lost {{V3.res}}; expected total {{V3.total}}.\n\n**Actions.** {{actions.approved}} of {{actions.total}} drafts approved (drafts only, nothing sent).\n\n**Residual risk.** The report rule is unchanged, so next year's bonus of {{CY.open}} stays hidden.\n\n*Simulated run (scripted replay). Figures calculated by the rebate engine from the synthetic company.*" },
            { end: "done" }
          ],
          baseline: [
            { state: "executing" },
            { say: "Loss accepted. I will not contact Apex. Drafting an internal memo that records the decision." },
            { draft: {
              type: "memo", recipient: "Procurement Controlling, GlobalCorp SE",
              subject: "Apex volume bonus not claimed: decision recorded",
              body: "Decision: no claim under the Apex framework agreement for {{AY.period}}. The bonus of {{AY.owed_full}} lapses on {{AY.deadline_date}}; with the report rule unchanged, next year's {{CY.open}} lapses too.\n\nThe look-alike account 40002 belongs to another group and was never part of the claim."
            } },
            { awaitActions: true },
            { report: "## Apex: loss accepted\n\n**What we found.** The look-alike accounts are two companies; Apex Robotics Solutions alone reached the 1.5 % tier.\n\n**Decision.** Do nothing; the loss is accepted. Not recovered: **{{var}}**.\n\n**Actions.** {{actions.approved}} of {{actions.total}} internal notes approved.\n\n*Simulated run (scripted replay). Figures calculated by the rebate engine from the synthetic company.*" },
            { end: "done" }
          ]
        }
      } }
    ]
  },

  "SC-AVGO-VMW": {
    title: "Broadcom rebate statement without VMware",
    steps: [
      { state: "scanning" },
      { say: "Signal received: IT procurement asks why VMware licences are still invoiced by VMware International in Ireland, and why Broadcom's statement credited only 1 %. First question: how does the Broadcom rebate work?" },
      { board: { group_ids: ["G-AVGO"], state: "at_risk" } },
      { tool: "erp_get_agreement", input: { agreement_id: "RA-AVGO" } },
      { say: "Finding: the rebate is tiered, 1 % from €10m, 2 % from €20m and 3 % from €30m, on all purchases of the year. Broadcom credits what its own statement shows for the accounts on its record, and differences must be claimed within 60 days; there is no set-off." },
      { tool: "erp_get_rebate_report", input: { agreement_id: "RA-AVGO" } },
      { tool: "erp_list_vendors", input: { query: "VMware" } },
      { say: "Hypothesis: VMware International Unlimited Co. (50003), with €14.9M last year, belongs to Broadcom and lifts the group to the 2 % tier." },
      { board: { vendor_ids: ["50003"], link_ids: ["L-50003"], state: "at_risk" } },

      { state: "verifying" },
      { open: "open_gleif_parent", input: { lei: "549300QDZDZP3SLIME17" },
        result: {
          source: "GLEIF Global LEI Index, level 1 and level 2 data (representative extract)",
          entity: { lei: "549300QDZDZP3SLIME17", legal_name: "VMWARE INTERNATIONAL UNLIMITED COMPANY", legal_address: "DUBLIN, IE", entity_status: "ACTIVE", registration_status: "ISSUED", globalcorp: "register entry of vendor 50003 (VMware International Unlimited Company), group G-AVGO" },
          ultimate_parent: { lei: "549300WV6GIDOZJTV909", legal_name: "BROADCOM INC.", entity_status: "ACTIVE", registration_status: "ISSUED", globalcorp: "ultimate parent of register group G-AVGO (Broadcom)" },
          relationship: { type: "IS_ULTIMATELY_CONSOLIDATED_BY", status: "ACTIVE" }
        } },
      { say: "Confirmed: the Global LEI Index shows VMware International Unlimited Company as ultimately consolidated by Broadcom Inc." },

      { state: "diagnosing" },
      { rebate: "hypothesis" },
      { say: "First estimate with VMware International counted: {{hyp.AY.spend}} reaches the {{hyp.AY.tier}} tier, so {{hyp.AY.open}} more than the statement credited for the agreement year. Before I claim, I check whether VMware has more accounts with us." },

      { state: "verifying" },
      { tool: "erp_family_tree", input: { group_id: "G-AVGO" } },
      { open: "open_gleif_parent", input: { lei: "549300BUDHS3LRWBE814" },
        result: {
          source: "GLEIF Global LEI Index, level 1 and level 2 data (representative extract)",
          entity: { lei: "549300BUDHS3LRWBE814", legal_name: "VMWARE LLC", legal_address: "WILMINGTON, US", entity_status: "ACTIVE", registration_status: "ISSUED", globalcorp: "register entry of vendor 50004 (VMware LLC), group G-AVGO" },
          ultimate_parent: { lei: "549300WV6GIDOZJTV909", legal_name: "BROADCOM INC.", entity_status: "ACTIVE", registration_status: "ISSUED", globalcorp: "ultimate parent of register group G-AVGO (Broadcom)" },
          relationship: { type: "IS_ULTIMATELY_CONSOLIDATED_BY", status: "ACTIVE" }
        } },
      { say: "Check: the register lists a second VMware account, VMware Global Inc. (50004), and GLEIF shows its legal entity, VMware LLC, as consolidated by Broadcom Inc. too. The register dates both to Broadcom's completion of the VMware deal on 22 November 2023." },
      { say: "Revised: one VMware account → two. VMware Global Inc. (50004) in Palo Alto belongs to Broadcom as well, which moves the group from the 2 % to the 3 % tier. The groups and acquisitions are real; GlobalCorp and its accounts are fictional." },
      { alert: {
        title: "Broadcom statement on the wrong tier: VMware accounts not on its record",
        severity: "high",
        summary: "Two VMware accounts invoice GlobalCorp outside Broadcom's rebate record, so the statement credited the 1 % tier. With both, the Broadcom group reaches the 3 % tier.",
        vendor_ids: ["50003", "50004"],
        group_ids: ["G-AVGO"],
        sources: [
          { title: "Subscription register: Broadcom family tree (representative extract)" },
          { title: "GLEIF level-2 record: VMware International Unlimited Company consolidated by Broadcom Inc. (representative)" },
          { title: "GLEIF level-2 record: VMware LLC consolidated by Broadcom Inc. (representative)" }
        ]
      } },

      { state: "diagnosing" },
      { tool: "erp_get_spend", input: { vendor_ids: ["50001", "50002", "50003", "50004"], agreement_id: "RA-AVGO" } },
      { rebate: "finding" },
      { say: "Impact: at {{AY.tier}} on {{AY.spend}}, Broadcom owes {{AY.owed_full}}; its statement credited {{AY.credited_full}}, so {{AY.open_full}} is open until {{AY.deadline_date}}. The previous year's difference of {{lost}} is already lost: that statement became final." },
      { board: { vendor_ids: ["50003", "50004"], link_ids: ["L-50003", "L-50004"], state: "affected" } },
      { say: "Response levers: no set-off, so a written claim for the difference, with three days of preparation; linking both VMware accounts puts them on Broadcom's record for the running year." },

      { options: {
        recommended: "V1",
        baseline_description: "The statement difference becomes final on {{AY.deadline_date}}, and next year's statement misses VMware again.",
        texts: {
          V1: {
            title: "Claim the difference and link both VMware accounts",
            description: "Claim the statement difference in writing, and set the Broadcom group key on both VMware accounts so they count on the next statement.",
            residual_risk: "Broadcom may ask for the VMware invoices per entity before correcting the statement."
          },
          V2: {
            title: "Claim the statement difference only",
            description: "Claim the difference in writing; leave the VMware accounts as they are.",
            residual_risk: "Next year's statement again misses VMware and credits the wrong tier."
          },
          V3: {
            title: "Link both VMware accounts only",
            description: "Fix the vendor master so the running year counts; do not claim the closed year.",
            residual_risk: "The agreement-year difference becomes final unclaimed."
          }
        }
      } },
      { say: "Recommendation: option A. It recovers {{V1.rec}} for {{V1.cost}}. Option B leaves {{V2.res}} to slip next year, and option C gives up {{V3.res}} for the closed year." },

      { awaitOption: {
        rejected: {
          V1: "Option A rejected. Option B claims the closed year only; option C fixes only the running year.",
          V2: "Option B rejected. Option A claims the difference and fixes the record.",
          V3: "Option C rejected. Options A and B both claim the closed year."
        },
        approved: {
          V1: [
            { state: "executing" },
            { say: "Option A approved. Drafting the claim for the statement difference and the vendor-master change for both VMware accounts. Each draft waits for your approval in the Outbox; nothing is sent." },
            { draft: {
              type: "email", recipient: "Broadcom Inc., Partner Rebates team",
              subject: "Statement difference for the agreement year {{AY.period}}: {{AY.open_full}}",
              body: "Dear Partner Rebates team,\n\nYour year-end statement for the agreement year {{AY.period}} credited {{AY.credited_full}}, the 1 % tier, on the accounts on your record.\n\nOur purchases from Broadcom Inc. and its Affiliates in that year totalled {{AY.spend_full}}, including VMware International Unlimited Company and VMware LLC, both part of Broadcom since 22 November 2023. Under § 3.1 this reaches the 3 % tier, a rebate of {{AY.owed_full}}.\n\nUnder § 3.3 we claim the difference of {{AY.open_full}} and ask for a corrected statement and a credit note.\n\nPlease confirm by {{date:+10}}; the claim period ends on {{AY.deadline_date}}.\n\nKind regards\nProcurement Controlling\nGlobalCorp SE"
            } },
            { draft: {
              type: "memo", recipient: "Master Data Management, GlobalCorp SE",
              subject: "Set group key BROADCOM on vendor accounts 50003 and 50004",
              body: "Request: maintain the group key BROADCOM (KONZS) on 50003 VMware International Unlimited Co. and 50004 VMware Global Inc., and link both to agreement RA-AVGO. The register lists both as Broadcom companies.\n\nWithout the link Broadcom's statement misses VMware again, and this year's difference of {{CY.open}} would slip. Please complete within 20 days."
            } },
            { board: { vendor_ids: ["50003", "50004"], link_ids: ["L-50003", "L-50004"], state: "resolved" } },
            { awaitActions: true },
            { report: "## Broadcom: rebate decision\n\n**What we found.** Two VMware accounts invoice GlobalCorp outside Broadcom's rebate record. The register and GLEIF confirm both as Broadcom companies. With them the group reached {{AY.spend}} and the 3 % tier, while the statement credited the 1 % tier.\n\n**If we do nothing.** The difference of {{AY.open}} becomes final on {{AY.deadline_date}}, and the running year slips too: **{{var}}** lost. The previous year's {{lost}} is already lost.\n\n**Decision.** Option A approved: claim the difference and link both VMware accounts.\n\n| | Do nothing | Option A |\n|---|---|---|\n| Response cost | – | {{V1.cost}} |\n| Rebate still lost | {{var}} | {{V1.res}} |\n| Expected total | {{var}} | {{V1.total}} |\n\n**Actions.** {{actions.approved}} of {{actions.total}} drafts approved in the outbox. They are drafts: nothing was sent.\n\n**Residual risk.** Broadcom may ask for invoice evidence per VMware entity.\n\n**How we know.** Membership from the register and GLEIF; spend from the ledger; every euro figure from the deterministic rebate engine.\n\n*Simulated run (scripted replay). Figures calculated by the rebate engine from the synthetic company.*" },
            { end: "done" }
          ],
          V2: [
            { state: "executing" },
            { say: "Option B approved. Drafting the claim for the statement difference; it waits for your approval in the Outbox." },
            { draft: {
              type: "email", recipient: "Broadcom Inc., Partner Rebates team",
              subject: "Statement difference for the agreement year {{AY.period}}: {{AY.open_full}}",
              body: "Dear Partner Rebates team,\n\nOur purchases from Broadcom Inc. and its Affiliates in the agreement year {{AY.period}}, including both VMware entities, totalled {{AY.spend_full}}: the 3 % tier, a rebate of {{AY.owed_full}}. Your statement credited {{AY.credited_full}}.\n\nUnder § 3.3 we claim the difference of {{AY.open_full}}. Please confirm by {{date:+10}}; the claim period ends on {{AY.deadline_date}}.\n\nKind regards\nProcurement Controlling\nGlobalCorp SE"
            } },
            { awaitActions: true },
            { report: "## Broadcom: rebate decision\n\n**What we found.** The Broadcom group reached the 3 % tier once both VMware accounts are counted; the statement credited 1 %.\n\n**If we do nothing.** **{{var}}** lost.\n\n**Decision.** Option B approved: claim the difference only. Response cost {{V2.cost}}; rebate still lost {{V2.res}}; expected total {{V2.total}}.\n\n**Actions.** {{actions.approved}} of {{actions.total}} drafts approved (drafts only, nothing sent).\n\n**Residual risk.** The VMware accounts stay off Broadcom's record, so next year's statement misses them again.\n\n*Simulated run (scripted replay). Figures calculated by the rebate engine from the synthetic company.*" },
            { end: "done" }
          ],
          V3: [
            { state: "executing" },
            { say: "Option C approved. Drafting the vendor-master change for both VMware accounts; the closed year is not claimed. The draft waits for your approval in the Outbox." },
            { draft: {
              type: "memo", recipient: "Master Data Management, GlobalCorp SE",
              subject: "Set group key BROADCOM on vendor accounts 50003 and 50004",
              body: "Request: maintain the group key BROADCOM (KONZS) on 50003 VMware International Unlimited Co. and 50004 VMware Global Inc., and link both to agreement RA-AVGO, so that this year's statement counts them. Please complete within 20 days."
            } },
            { board: { vendor_ids: ["50003", "50004"], link_ids: ["L-50003", "L-50004"], state: "resolved" } },
            { awaitActions: true },
            { report: "## Broadcom: rebate decision\n\n**What we found.** Two VMware accounts are Broadcom companies outside Broadcom's record; with them the group reached the 3 % tier.\n\n**If we do nothing.** **{{var}}** lost.\n\n**Decision.** Option C approved: link both VMware accounts only. Response cost {{V3.cost}}; rebate still lost {{V3.res}}; expected total {{V3.total}}.\n\n**Actions.** {{actions.approved}} of {{actions.total}} drafts approved (drafts only, nothing sent).\n\n**Residual risk.** The closed year's difference of {{AY.open}} becomes final unclaimed on {{AY.deadline_date}}.\n\n*Simulated run (scripted replay). Figures calculated by the rebate engine from the synthetic company.*" },
            { end: "done" }
          ],
          baseline: [
            { state: "executing" },
            { say: "Loss accepted. I will not contact Broadcom. Drafting an internal memo that records the decision." },
            { draft: {
              type: "memo", recipient: "Procurement Controlling, GlobalCorp SE",
              subject: "Broadcom statement difference not claimed: decision recorded",
              body: "Decision: no claim for the Broadcom statement difference for {{AY.period}}. The difference of {{AY.open_full}} becomes final on {{AY.deadline_date}}; with the VMware accounts unlinked, this year's {{CY.open}} follows."
            } },
            { awaitActions: true },
            { report: "## Broadcom: loss accepted\n\n**What we found.** With both VMware accounts the Broadcom group reached the 3 % tier; the statement credited 1 %.\n\n**Decision.** Do nothing; the loss is accepted. Not recovered: **{{var}}**.\n\n**Actions.** {{actions.approved}} of {{actions.total}} internal notes approved.\n\n*Simulated run (scripted replay). Figures calculated by the rebate engine from the synthetic company.*" },
            { end: "done" }
          ]
        }
      } }
    ]
  },

  "SC-SCHN-AVEVA": {
    title: "Schneider Electric, AVEVA and a closing claim window",
    steps: [
      { state: "scanning" },
      { say: "Signal received: AVEVA's account manager says AVEVA's licences should count towards our Schneider framework agreement, and that agreement year closed almost three months ago. First question: how long is the claim window?" },
      { board: { group_ids: ["G-SCHN"], state: "at_risk" } },
      { tool: "erp_get_agreement", input: { agreement_id: "RA-SCHN" } },
      { say: "Finding: Schneider credits 2.5 % on all purchases of the year from €15m, and § 4.6 excludes claims made more than 90 days after the year end. The window is nearly over, so speed matters." },
      { tool: "erp_list_vendors", input: { query: "Schneider, AVEVA" } },
      { say: "Hypothesis: the clause speaks of GlobalCorp's purchases, so I start with central procurement: Schneider Electric GmbH (60001) and AVEVA Solutions (60003), both invoiced to GlobalCorp SE in Frankfurt. The UK company's account, Schneider Electric Ltd (60002), stays out for now." },
      { board: { vendor_ids: ["60003"], link_ids: ["L-60003"], state: "at_risk" } },

      { state: "verifying" },
      { tool: "erp_family_tree", input: { vendor_id: "60003" } },
      { say: "Check: the register lists AVEVA Solutions as a Schneider Electric company, fully owned since 18 January 2023, but its account carries no group key." },

      { state: "diagnosing" },
      { rebate: "hypothesis" },
      { say: "First estimate, central purchases only: {{hyp.AY.spend}} misses the €15m threshold for the agreement year, so nothing is owed for it; only the running year would cross it, {{hyp.var}} by {{hyp.first_loss_date}}." },

      { state: "verifying" },
      { open: "open_gleif_parent", input: { lei: "213800B9EV3SYDO3W459" },
        result: {
          source: "GLEIF Global LEI Index, level 1 and level 2 data (representative extract)",
          entity: { lei: "213800B9EV3SYDO3W459", legal_name: "AVEVA SOLUTIONS LIMITED", legal_address: "CAMBRIDGE, GB", entity_status: "ACTIVE", registration_status: "ISSUED", globalcorp: "register entry of vendor 60003 (AVEVA Solutions Limited), group G-SCHN" },
          ultimate_parent: { lei: "969500A1YF1XUYYXS284", legal_name: "SCHNEIDER ELECTRIC SE", entity_status: "ACTIVE", registration_status: "ISSUED", globalcorp: "ultimate parent of register group G-SCHN (Schneider Electric)" },
          relationship: { type: "IS_ULTIMATELY_CONSOLIDATED_BY", status: "ACTIVE" }
        } },
      { say: "Confirmed: GLEIF shows AVEVA Solutions Limited as ultimately consolidated by Schneider Electric SE, and AVEVA's announcement dates the completed take-over to 18 January 2023." },
      { web: {
        query: "AVEVA completion of acquisition by Schneider Electric",
        summary: "1 result: AVEVA's completion announcement",
        results: [
          { title: "AVEVA announces the completion of its acquisition by Schneider Electric", source: "AVEVA press release", page_age: "18 January 2023" }
        ]
      } },
      { tool: "erp_get_vendor", input: { vendor_id: "60002" } },
      { say: "Check: § 4 counts the purchases of GlobalCorp SE and its affiliated companies, all company codes, and Schneider Electric Ltd invoices GlobalCorp UK in Birmingham." },
      { say: "Revised: central purchases only → all company codes. The UK account counts too, and with it the agreement year crosses the threshold." },
      { alert: {
        title: "Schneider rebate earned, claim window closing",
        severity: "critical",
        summary: "Counted across all company codes and with AVEVA, GlobalCorp's purchases from Schneider Electric crossed the 2.5 % threshold, but AVEVA is not linked and no claim was filed. § 4.6 excludes any claim after the 90-day window.",
        vendor_ids: ["60003"],
        group_ids: ["G-SCHN"],
        sources: [
          { title: "Schneider framework agreement § 4 and § 4.6 (ERP)" },
          { title: "Subscription register: Schneider Electric family tree (representative extract)" },
          { title: "GLEIF level-2 record: AVEVA Solutions Limited consolidated by Schneider Electric SE (representative)" }
        ]
      } },

      { state: "diagnosing" },
      { tool: "erp_get_rebate_report", input: { agreement_id: "RA-SCHN" } },
      { rebate: "finding" },
      { say: "Impact: Schneider owes {{AY.owed_full}} for the agreement year, {{AY.tier}} of {{AY.spend}}, and the claim must reach Schneider by {{AY.deadline_date}}: {{AY.deadline_day}} days from today. After that it is excluded. Next year's {{CY.open}} follows unless AVEVA is linked." },
      { board: { vendor_ids: ["60003"], link_ids: ["L-60003"], state: "affected" } },
      { say: "Response levers: three days to prepare the claim; § 10 allows set-off against open Schneider invoices; a recovery-audit firm would need about 35 days, far too slow for this window." },

      { options: {
        recommended: "V1",
        baseline_description: "The claim is excluded after {{AY.deadline_date}}, and next year's rebate slips too.",
        texts: {
          V1: {
            title: "Claim this week and link AVEVA",
            description: "File the written claim within three days, and set the Schneider group key on AVEVA so the running year counts.",
            residual_risk: "If the claim misses the window by a day, § 4.6 excludes it: it must go out this week."
          },
          V2: {
            title: "Set-off notice this week, link AVEVA",
            description: "Send the set-off notice within three days, which is also the claim under § 4.6; unless Schneider objects within seven days, deduct the rebate from open Schneider invoices in the next payment run. Link AVEVA as in option A.",
            residual_risk: "Schneider may dispute a set-off made this close to the deadline."
          },
          V3: {
            title: "Hire a recovery-audit firm, link AVEVA",
            description: "Engage a recovery-audit firm on contingency for the claim, and link AVEVA.",
            residual_risk: "The firm cannot file before the window closes, so the agreement-year rebate is lost."
          }
        }
      } },
      { say: "Recommendation: option A: file the claim this week, {{V1.cost}} in total. Option B also works and brings the cash in on day {{V2.time}}; option C shows the trap: the audit firm files too late and recovers only next year's {{V3.rec}}." },

      { awaitOption: {
        rejected: {
          V1: "Option A rejected. Option B claims by set-off notice this week; option C cannot meet the deadline.",
          V2: "Option B rejected. Option A files the claim this week by letter.",
          V3: "Option C rejected. Options A and B both reach Schneider in time."
        },
        approved: {
          V1: [
            { state: "executing" },
            { say: "Option A approved. Drafting the claim letter to Schneider Electric and the vendor-master change for AVEVA. Each draft waits for your approval in the Outbox; nothing is sent." },
            { draft: {
              type: "email", recipient: "Schneider Electric SE, Key Account Rebates",
              subject: "Rebate claim under § 4 for the agreement year {{AY.period}}: {{AY.owed_full}}",
              body: "Dear Key Account Rebates team,\n\nUnder § 4 of our framework agreement, Schneider Electric credits 2.5 % of all purchases of an agreement year once the purchases of GlobalCorp SE and its affiliated companies from Schneider Electric SE and its Affiliates reach €15.0m.\n\nIn the agreement year {{AY.period}} these purchases totalled {{AY.spend_full}}, across all company codes and including AVEVA Solutions Limited, fully owned by Schneider Electric since 18 January 2023.\n\nWe therefore claim {{AY.owed_full}} and ask for a credit note. This claim is made within the period of § 4.6, which ends on {{AY.deadline_date}}.\n\nPlease confirm receipt by {{date:+5}}.\n\nKind regards\nProcurement Controlling\nGlobalCorp SE"
            } },
            { draft: {
              type: "memo", recipient: "Master Data Management, GlobalCorp SE",
              subject: "Set group key SCHNEIDER on vendor account 60003",
              body: "Request: maintain the group key SCHNEIDER (KONZS) on 60003 AVEVA Solutions Ltd and link it to agreement RA-SCHN. The register lists AVEVA as a Schneider Electric company. Without it, this year's rebate of {{CY.open}} would be missed again. Please complete within 20 days."
            } },
            { board: { vendor_ids: ["60003"], link_ids: ["L-60003"], state: "resolved" } },
            { awaitActions: true },
            { report: "## Schneider Electric: rebate decision\n\n**What we found.** Counted across all company codes and with AVEVA, a Schneider Electric company confirmed by the register, GLEIF and AVEVA's announcement, GlobalCorp's purchases reached {{AY.spend}} and the 2.5 % tier. AVEVA was not linked and no claim was filed.\n\n**If we do nothing.** The claim of {{AY.owed}} is excluded after {{AY.deadline_date}}, in {{AY.deadline_day}} days, and next year slips too: **{{var}}** lost.\n\n**Decision.** Option A approved: claim this week and link AVEVA.\n\n| | Do nothing | Option A |\n|---|---|---|\n| Response cost | – | {{V1.cost}} |\n| Rebate still lost | {{var}} | {{V1.res}} |\n| Expected total | {{var}} | {{V1.total}} |\n\n**Actions.** {{actions.approved}} of {{actions.total}} drafts approved in the outbox. They are drafts: nothing was sent.\n\n**Residual risk.** The claim must leave this week; a recovery-audit firm would have been too slow.\n\n**How we know.** Clause, ledger and company codes from the ERP; membership from the register, GLEIF and Schneider's announcement; every euro figure from the deterministic rebate engine.\n\n*Simulated run (scripted replay). Figures calculated by the rebate engine from the synthetic company.*" },
            { end: "done" }
          ],
          V2: [
            { state: "executing" },
            { say: "Option B approved. Drafting the set-off notice, the posting and the vendor-master change; each draft waits for your approval in the Outbox." },
            { draft: {
              type: "email", recipient: "Schneider Electric SE, Key Account Rebates",
              subject: "Notice of set-off under § 10: rebate {{AY.period}}, {{AY.owed_full}}",
              body: "Dear Key Account Rebates team,\n\nIn the agreement year {{AY.period}} the purchases of GlobalCorp SE and its affiliated companies from Schneider Electric and its Affiliates, including AVEVA, reached {{AY.spend_full}}. Under § 4 a rebate of {{AY.owed_full}} is due, and this notice is our claim within § 4.6.\n\nAs § 10 allows, we will set the amount off against open Schneider invoices in the first payment run after {{V2.objection_date}}. Please raise any objection by {{V2.objection_date}}.\n\nKind regards\nProcurement Controlling\nGlobalCorp SE"
            } },
            { draft: {
              type: "posting", recipient: "Accounts Payable, GlobalCorp SE (company code CC-1000)",
              subject: "Set-off posting: Schneider Electric rebate {{AY.period}}",
              body: "Company code: CC-1000 GlobalCorp SE\nVendor: 60001 Schneider Electric GmbH (open invoices of the Schneider group)\nAmount: {{AY.owed_full}} credit against open invoices\nReference: RA-SCHN § 4 and § 10, agreement year {{AY.period}}\nPayment run: first run after {{V2.objection_date}} (end of the objection period)"
            } },
            { draft: {
              type: "memo", recipient: "Master Data Management, GlobalCorp SE",
              subject: "Set group key SCHNEIDER on vendor account 60003",
              body: "Request: maintain the group key SCHNEIDER (KONZS) on 60003 AVEVA Solutions Ltd and link it to agreement RA-SCHN. Please complete within 20 days."
            } },
            { board: { vendor_ids: ["60003"], link_ids: ["L-60003"], state: "resolved" } },
            { awaitActions: true },
            { report: "## Schneider Electric: rebate decision\n\n**What we found.** Across all company codes and with AVEVA, GlobalCorp's purchases crossed Schneider's 2.5 % threshold; no claim was filed and the window closes on {{AY.deadline_date}}.\n\n**If we do nothing.** **{{var}}** lost.\n\n**Decision.** Option B approved: set-off notice this week, deduction after the objection period, and the AVEVA link. Response cost {{V2.cost}}; rebate still lost {{V2.res}}; expected total {{V2.total}}; cash on day {{V2.time}}.\n\n**Actions.** {{actions.approved}} of {{actions.total}} drafts approved (drafts only, nothing sent or posted).\n\n**Residual risk.** Schneider may dispute a set-off made this close to the deadline.\n\n*Simulated run (scripted replay). Figures calculated by the rebate engine from the synthetic company.*" },
            { end: "done" }
          ],
          V3: [
            { state: "executing" },
            { say: "Option C approved. Drafting the engagement of the recovery-audit firm and the vendor-master change. The firm cannot meet this year's window, so only the running year is protected." },
            { draft: {
              type: "email", recipient: "Contracted recovery-audit firm, rebate recovery practice",
              subject: "Engagement: Schneider Electric rebate review",
              body: "Dear recovery team,\n\nWe would like to engage you on contingency to review our Schneider Electric framework agreement, accounts 60001, 60002 and 60003, and to file any claim that is still possible.\n\nPlease note that claims for the agreement year {{AY.period}} are excluded after {{AY.deadline_date}}.\n\nKind regards\nProcurement Controlling\nGlobalCorp SE"
            } },
            { draft: {
              type: "memo", recipient: "Master Data Management, GlobalCorp SE",
              subject: "Set group key SCHNEIDER on vendor account 60003",
              body: "Request: maintain the group key SCHNEIDER (KONZS) on 60003 AVEVA Solutions Ltd and link it to agreement RA-SCHN. Please complete within 20 days."
            } },
            { board: { vendor_ids: ["60003"], link_ids: ["L-60003"], state: "resolved" } },
            { awaitActions: true },
            { report: "## Schneider Electric: rebate decision\n\n**What we found.** GlobalCorp's purchases crossed Schneider's 2.5 % threshold across all company codes and with AVEVA.\n\n**If we do nothing.** **{{var}}** lost.\n\n**Decision.** Option C approved: recovery-audit firm and the AVEVA link. Response cost {{V3.cost}}; rebate still lost {{V3.res}}; expected total {{V3.total}}.\n\n**Actions.** {{actions.approved}} of {{actions.total}} drafts approved (drafts only, nothing sent).\n\n**Residual risk.** The firm files after {{AY.deadline_date}}, so the agreement-year rebate of {{AY.owed}} is lost; only the running year is protected.\n\n*Simulated run (scripted replay). Figures calculated by the rebate engine from the synthetic company.*" },
            { end: "done" }
          ],
          baseline: [
            { state: "executing" },
            { say: "Loss accepted. I will not contact Schneider Electric. Drafting an internal memo that records the decision." },
            { draft: {
              type: "memo", recipient: "Procurement Controlling, GlobalCorp SE",
              subject: "Schneider Electric rebate not claimed: decision recorded",
              body: "Decision: no claim under the Schneider framework agreement for {{AY.period}}. The rebate of {{AY.owed_full}} is excluded after {{AY.deadline_date}}; with AVEVA unlinked, this year's {{CY.open}} follows."
            } },
            { awaitActions: true },
            { report: "## Schneider Electric: loss accepted\n\n**What we found.** Across all company codes and with AVEVA, GlobalCorp's purchases crossed the 2.5 % threshold.\n\n**Decision.** Do nothing; the loss is accepted. Not recovered: **{{var}}**.\n\n**Actions.** {{actions.approved}} of {{actions.total}} internal notes approved.\n\n*Simulated run (scripted replay). Figures calculated by the rebate engine from the synthetic company.*" },
            { end: "done" }
          ]
        }
      } }
    ]
  },

  "SC-CRM-FX": {
    title: "Salesforce invoices in pounds outside the euro report",
    steps: [
      { state: "scanning" },
      { say: "Signal received: UK finance says Salesforce UK and Tableau invoice GlobalCorp UK in pounds, and the year-end rebate report only shows euro invoices. First question: what does the agreement say about other currencies?" },
      { board: { group_ids: ["G-CRM"], state: "at_risk" } },
      { tool: "erp_get_agreement", input: { agreement_id: "RA-CRM" } },
      { say: "Finding: Salesforce credits 3 % on all purchases of the year from €20m, and Annex C counts pound invoices at a fixed 1 GBP = 1.17 EUR. Three accounts are linked, but the year-end report is set up for euro invoices only." },
      { tool: "erp_get_rebate_report", input: { agreement_id: "RA-CRM" } },
      { say: "Hypothesis: the pound invoices of Salesforce UK (70003) are the gap. Converted at the contract rate, they lift the group over €20m." },
      { board: { vendor_ids: ["70003"], state: "at_risk" } },

      { state: "verifying" },
      { open: "open_ecb_rate", input: { currency: "GBP" },
        result: {
          source: "European Central Bank euro reference rates via the Frankfurter API (representative values)",
          currency: "GBP", per_eur: 0.8668, eur_per_unit: 1.1537,
          contract_rates: [{ agreement_id: "RA-CRM", eur_per_unit: 1.17 }],
          note: "Agreements with a fixed rate convert at that rate, whatever the market rate (see their clause)."
        } },
      { say: "Check: the ECB reference rate is close to the Annex C rate, but the agreement converts at its fixed rate, so the contract rate applies, whatever the market does." },

      { state: "diagnosing" },
      { rebate: "hypothesis" },
      { say: "First estimate with Salesforce UK at the contract rate: {{hyp.AY.spend}}, the {{hyp.AY.tier}} tier, {{hyp.AY.owed}} for the agreement year. Next I check whether Salesforce has more accounts with us." },

      { state: "verifying" },
      { tool: "erp_list_vendors", input: { query: "Salesforce, Slack, Tableau" } },
      { tool: "erp_family_tree", input: { group_id: "G-CRM" } },
      { say: "Finding: Tableau Software UK (70004) has no group key in the vendor master, but the register lists Tableau as a Salesforce company since August 2019." },
      { web: {
        query: "Salesforce completes acquisition of Tableau",
        summary: "1 result: Salesforce's completion announcement",
        results: [
          { title: "Salesforce Completes Acquisition of Tableau", source: "Salesforce newsroom", page_age: "1 August 2019" }
        ]
      } },
      { say: "Confirmed: Salesforce's own announcement shows the Tableau acquisition completed on 1 August 2019, long before this agreement year." },
      { say: "Revised: three accounts → four. Tableau's pound invoices count as well, at the same contract rate. The groups and acquisitions are real; GlobalCorp and its accounts are fictional." },
      { alert: {
        title: "Salesforce rebate missed: pound invoices left out of the euro report",
        severity: "high",
        summary: "The year-end report counts only euro invoices, so Salesforce UK's pound invoices never counted, and Tableau is not linked at all. At the contract rate, the Salesforce group crossed the 3 % threshold.",
        vendor_ids: ["70003", "70004"],
        group_ids: ["G-CRM"],
        sources: [
          { title: "Salesforce enterprise agreement § 7.1 and Annex C, fixed rates (ERP)" },
          { title: "Subscription register: Salesforce family tree (representative extract)" },
          { title: "Salesforce newsroom: Tableau acquisition completed (representative)" }
        ]
      } },

      { state: "diagnosing" },
      { rebate: "finding" },
      { say: "Impact: Salesforce owes {{AY.owed_full}} for the agreement year, {{AY.tier}} of {{AY.spend}} at the contract rate, due by {{AY.deadline_date}}. The previous year's {{lost}} is already lost, and next year's {{CY.open}} follows unless both the report rule and Tableau's link are fixed: {{var}} at risk." },
      { board: { vendor_ids: ["70003", "70004"], link_ids: ["L-70004"], company_code_ids: ["CC-2000"], state: "affected" } },
      { say: "Response levers: a claim within three days; set-off is allowed; changing the report to count every currency at the contract rates, and linking Tableau, each protect the running year, but only together." },

      { options: {
        recommended: "V1",
        baseline_description: "The claim lapses on {{AY.deadline_date}}, and the euro-only report misses next year too.",
        texts: {
          V1: {
            title: "Claim, link Tableau and fix the currency rule",
            description: "File the written claim, set the Salesforce group key on Tableau, and have the year-end report count every currency at the contract rates.",
            residual_risk: "Salesforce may ask for the pound invoices per entity."
          },
          V2: {
            title: "Claim and fix the currency rule only",
            description: "File the claim and change the report rule; leave Tableau unlinked.",
            residual_risk: "Tableau's share of next year's rebate is still missed."
          },
          V3: {
            title: "Claim and link Tableau only",
            description: "File the claim and link Tableau; leave the euro-only report rule unchanged.",
            residual_risk: "The report still ignores pound invoices, so next year's rebate is missed altogether."
          }
        }
      } },
      { say: "Recommendation: option A. It recovers {{V1.rec}} for {{V1.cost}}. The engine shows why both fixes matter: option B still loses {{V2.res}}, and option C loses {{V3.res}}, because linking Tableau does not help while the report ignores pounds." },

      { awaitOption: {
        rejected: {
          V1: "Option A rejected. Option B fixes the currency rule only; option C links Tableau only.",
          V2: "Option B rejected. Option A also links Tableau; option C links Tableau without the report fix.",
          V3: "Option C rejected. Options A and B both fix the currency rule."
        },
        approved: {
          V1: [
            { state: "executing" },
            { say: "Option A approved. Drafting the claim letter to Salesforce, the Tableau link and the report change. Each draft waits for your approval in the Outbox; nothing is sent." },
            { draft: {
              type: "email", recipient: "Salesforce, Inc., Customer Rebates team",
              subject: "Volume rebate claim for the agreement year {{AY.period}}: {{AY.owed_full}}",
              body: "Dear Customer Rebates team,\n\nUnder § 7.1 of our enterprise agreement, Salesforce credits 3 % of all purchases of an agreement year once purchases from Salesforce, Inc. and its Affiliates reach €20.0m; § 7.2 and Annex C count invoices in pounds at 1 GBP = 1.17 EUR.\n\nIn the agreement year {{AY.period}} our purchases, including Salesforce UK Ltd and Tableau Software UK (part of Salesforce since August 2019), totalled {{AY.spend_full}} at the contract rate.\n\nWe therefore claim {{AY.owed_full}} and ask for a credit note.\n\nPlease confirm by {{date:+14}}; the claim period under § 7.5 ends on {{AY.deadline_date}}.\n\nKind regards\nProcurement Controlling\nGlobalCorp SE"
            } },
            { draft: {
              type: "memo", recipient: "Master Data Management, GlobalCorp SE",
              subject: "Set group key SALESFORCE on vendor account 70004",
              body: "Request: maintain the group key SALESFORCE (KONZS) on 70004 Tableau Software UK and link it to agreement RA-CRM. The register lists Tableau as a Salesforce company. Please complete within 20 days."
            } },
            { draft: {
              type: "memo", recipient: "Procurement reporting team, GlobalCorp SE",
              subject: "Change request: year-end rebate report to count every currency at contract rates",
              body: "Request: the year-end rebate report for RA-CRM counts euro invoices only. Please count invoices in every currency at the agreement's fixed rates (Annex C: 1 GBP = 1.17 EUR).\n\nWhy: the pound invoices of Salesforce UK and Tableau were left out, and the rebate of {{AY.owed_full}} was never claimed. Next year's {{CY.open}} would be missed the same way.\n\nPlease implement within 15 days."
            } },
            { board: { vendor_ids: ["70003", "70004"], link_ids: ["L-70004"], company_code_ids: ["CC-2000"], state: "resolved" } },
            { awaitActions: true },
            { report: "## Salesforce: rebate decision\n\n**What we found.** The year-end report counts only euro invoices, so Salesforce UK's pound invoices never counted, and Tableau, a Salesforce company since 2019 per the register and Salesforce's announcement, is not linked. At the contract rate of Annex C the group reached {{AY.spend}} and the 3 % tier.\n\n**If we do nothing.** The claim of {{AY.owed}} lapses on {{AY.deadline_date}}, and the running year slips too: **{{var}}** lost. The previous year's {{lost}} is already lost.\n\n**Decision.** Option A approved: claim, link Tableau and fix the currency rule.\n\n| | Do nothing | Option A |\n|---|---|---|\n| Response cost | – | {{V1.cost}} |\n| Rebate still lost | {{var}} | {{V1.res}} |\n| Expected total | {{var}} | {{V1.total}} |\n\n**Actions.** {{actions.approved}} of {{actions.total}} drafts approved in the outbox. They are drafts: nothing was sent.\n\n**Residual risk.** Salesforce may ask for the pound invoices per entity.\n\n**How we know.** Clause, rates and report from the ERP; membership from the register and Salesforce's announcement; the ECB rate as a cross-check; every euro figure from the deterministic rebate engine.\n\n*Simulated run (scripted replay). Figures calculated by the rebate engine from the synthetic company.*" },
            { end: "done" }
          ],
          V2: [
            { state: "executing" },
            { say: "Option B approved. Drafting the claim letter and the report change; each draft waits for your approval in the Outbox." },
            { draft: {
              type: "email", recipient: "Salesforce, Inc., Customer Rebates team",
              subject: "Volume rebate claim for the agreement year {{AY.period}}: {{AY.owed_full}}",
              body: "Dear Customer Rebates team,\n\nIn the agreement year {{AY.period}} our purchases from Salesforce, Inc. and its Affiliates totalled {{AY.spend_full}} at the rates of Annex C. Under § 7.1 we claim {{AY.owed_full}} and ask for a credit note.\n\nPlease confirm by {{date:+14}}; the claim period ends on {{AY.deadline_date}}.\n\nKind regards\nProcurement Controlling\nGlobalCorp SE"
            } },
            { draft: {
              type: "memo", recipient: "Procurement reporting team, GlobalCorp SE",
              subject: "Change request: year-end rebate report to count every currency at contract rates",
              body: "Request: count invoices in every currency at the agreements' fixed rates in the year-end rebate report (RA-CRM Annex C: 1 GBP = 1.17 EUR). Please implement within 15 days."
            } },
            { board: { vendor_ids: ["70003"], company_code_ids: ["CC-2000"], state: "resolved" } },
            { awaitActions: true },
            { report: "## Salesforce: rebate decision\n\n**What we found.** The euro-only report left out the pound invoices; with them, and with Tableau, the Salesforce group crossed the 3 % threshold.\n\n**If we do nothing.** **{{var}}** lost.\n\n**Decision.** Option B approved: claim and fix the currency rule. Response cost {{V2.cost}}; rebate still lost {{V2.res}}; expected total {{V2.total}}.\n\n**Actions.** {{actions.approved}} of {{actions.total}} drafts approved (drafts only, nothing sent).\n\n**Residual risk.** Tableau stays unlinked, so its share of next year's rebate is missed.\n\n*Simulated run (scripted replay). Figures calculated by the rebate engine from the synthetic company.*" },
            { end: "done" }
          ],
          V3: [
            { state: "executing" },
            { say: "Option C approved. Drafting the claim letter and the Tableau link; the report rule stays as it is. Each draft waits for your approval in the Outbox." },
            { draft: {
              type: "email", recipient: "Salesforce, Inc., Customer Rebates team",
              subject: "Volume rebate claim for the agreement year {{AY.period}}: {{AY.owed_full}}",
              body: "Dear Customer Rebates team,\n\nIn the agreement year {{AY.period}} our purchases from Salesforce, Inc. and its Affiliates, including Tableau, totalled {{AY.spend_full}} at the rates of Annex C. Under § 7.1 we claim {{AY.owed_full}} and ask for a credit note.\n\nPlease confirm by {{date:+14}}; the claim period ends on {{AY.deadline_date}}.\n\nKind regards\nProcurement Controlling\nGlobalCorp SE"
            } },
            { draft: {
              type: "memo", recipient: "Master Data Management, GlobalCorp SE",
              subject: "Set group key SALESFORCE on vendor account 70004",
              body: "Request: maintain the group key SALESFORCE (KONZS) on 70004 Tableau Software UK and link it to agreement RA-CRM. Please complete within 20 days."
            } },
            { board: { company_code_ids: ["CC-2000"], state: "at_risk" } },
            { awaitActions: true },
            { report: "## Salesforce: rebate decision\n\n**What we found.** With the pound invoices at the contract rate and Tableau, the Salesforce group crossed the 3 % threshold.\n\n**If we do nothing.** **{{var}}** lost.\n\n**Decision.** Option C approved: claim and link Tableau. Response cost {{V3.cost}}; rebate still lost {{V3.res}}; expected total {{V3.total}}.\n\n**Actions.** {{actions.approved}} of {{actions.total}} drafts approved (drafts only, nothing sent).\n\n**Residual risk.** The report still ignores pound invoices, so next year's rebate of {{CY.open}} is missed.\n\n*Simulated run (scripted replay). Figures calculated by the rebate engine from the synthetic company.*" },
            { end: "done" }
          ],
          baseline: [
            { state: "executing" },
            { say: "Loss accepted. I will not contact Salesforce. Drafting an internal memo that records the decision." },
            { draft: {
              type: "memo", recipient: "Procurement Controlling, GlobalCorp SE",
              subject: "Salesforce rebate not claimed: decision recorded",
              body: "Decision: no claim under the Salesforce enterprise agreement for {{AY.period}}. The rebate of {{AY.owed_full}} lapses on {{AY.deadline_date}}; with the report rule and Tableau unchanged, next year's {{CY.open}} follows."
            } },
            { awaitActions: true },
            { report: "## Salesforce: loss accepted\n\n**What we found.** At the contract rate and with Tableau, the Salesforce group crossed the 3 % threshold.\n\n**Decision.** Do nothing; the loss is accepted. Not recovered: **{{var}}**.\n\n**Actions.** {{actions.approved}} of {{actions.total}} internal notes approved.\n\n*Simulated run (scripted replay). Figures calculated by the rebate engine from the synthetic company.*" },
            { end: "done" }
          ]
        }
      } }
    ]
  }
};
