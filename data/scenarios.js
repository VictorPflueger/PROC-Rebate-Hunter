/*
 * REBATE HUNTER — injectable rebate signals.
 *
 * Each scenario is only a short, UNVERIFIED trigger ("seed") written the way a first hint typically
 * arrives (a category manager's remark, a duplicate-vendor alert, a supplier's account manager).
 * In Live mode the agent receives the seed text and nothing else: it must find the agreement and
 * the accounts, verify the group membership (subscription register plus GLEIF, Wikidata or the web),
 * quantify it with the deterministic rebate engine and propose options.
 *
 * `agreement_id` is the agreement the rebate board shows when the scenario is chosen or starts (the
 * agent never sees it). `exposure_check` is used ONLY by the offline integrity check
 * (js/world_check.js) and is never shown to the agent.
 */
window.SCENARIOS = [
  {
    id: "SC-CISCO-MA",
    number: 1,
    title: "Cisco acquisitions invoiced on separate accounts",
    short: "Cisco acquisitions",
    category: "Acquisitions / vendor master",
    seed: "Unverified tip from a category manager: Meraki and Acacia invoices are booked on their own vendor accounts and never counted towards the Cisco volume rebate. The agreement pays 2 % once purchases from Cisco and its affiliates reach €50m in an agreement year, and the year-end rebate report shows no claim.",
    agreement_id: "RA-CISCO",
    exposure_check: { agreement_id: "RA-CISCO", vendor_ids: ["10001", "10002", "10003", "10004", "10005"] }
  },
  {
    id: "SC-MSFT-PY",
    number: 2,
    title: "Microsoft volume incentive and the Activision accounts",
    short: "Microsoft look-back",
    category: "Threshold / look-back clause",
    seed: "Unverified note from the licence management team: Activision Blizzard has belonged to Microsoft since 2023, but its invoices sit on a separate vendor account. Could the Microsoft volume incentive (2 % once a year's purchases reach €50m) have been missed?",
    agreement_id: "RA-MSFT",
    exposure_check: { agreement_id: "RA-MSFT", vendor_ids: ["20001", "20002"] }
  },
  {
    id: "SC-APEX-NAME",
    number: 3,
    title: "Look-alike vendors: Apex Robotics",
    short: "Apex look-alikes",
    category: "Duplicate check / growth bonus",
    seed: "Unverified alert from the duplicate-vendor check: 'Apex Robotics Solutions GmbH' (Stuttgart) and 'Apex Robotics Systems Ltd.' (Manchester) look like one supplier, with a name similarity of 67 %. Together they would reach the 3 % growth-bonus tier of the Apex framework agreement.",
    agreement_id: "RA-APEX",
    exposure_check: { agreement_id: "RA-APEX", vendor_ids: ["40001", "40002"] }
  },
  {
    id: "SC-AVGO-VMW",
    number: 4,
    title: "Broadcom rebate statement without VMware",
    short: "Broadcom and VMware",
    category: "Tiered rebate / supplier statement",
    seed: "Unverified question from IT procurement: since Broadcom bought VMware, VMware licences are still invoiced by 'VMware International Unlimited Co.' in Ireland. Broadcom's year-end rebate statement credited only 1 %. Are we on the wrong tier?",
    agreement_id: "RA-AVGO",
    exposure_check: { agreement_id: "RA-AVGO", vendor_ids: ["50001", "50002", "50003", "50004"] }
  },
  {
    id: "SC-SCHN-AVEVA",
    number: 5,
    title: "Schneider Electric, AVEVA and a closing claim window",
    short: "Schneider and AVEVA",
    category: "Claim deadline",
    seed: "Unverified remark from AVEVA's account manager: AVEVA belongs to Schneider Electric, so its licences 'should count towards your Schneider framework agreement'. The agreement year closed almost three months ago.",
    agreement_id: "RA-SCHN",
    exposure_check: { agreement_id: "RA-SCHN", vendor_ids: ["60001", "60002", "60003"] }
  },
  {
    id: "SC-CRM-FX",
    number: 6,
    title: "Salesforce invoices in pounds outside the euro report",
    short: "Salesforce in pounds",
    category: "Currency / report rule",
    seed: "Unverified observation from the UK finance team: Salesforce UK and Tableau invoice GlobalCorp UK in pounds sterling, and the year-end rebate report only shows euro invoices. The Salesforce agreement pays 3 % once a year's purchases reach €20m.",
    agreement_id: "RA-CRM",
    exposure_check: { agreement_id: "RA-CRM", vendor_ids: ["70001", "70002", "70003", "70004"] }
  }
];
