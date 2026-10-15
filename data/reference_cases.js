/*
 * REBATE HUNTER — reference cases for the six preset scenarios.
 *
 * A reference case is the rebate position and the response options a representative agent run
 * would arrive at AFTER verification. It serves two purposes:
 *   1. the scripted Simulation mode computes every € figure from these specs with the same
 *      deterministic engine the live agent uses (js/rebate.js): numbers are never typed in;
 *   2. the integrity check (js/world_check.js) runs them to prove each scenario bites.
 * The live agent never sees this file: it must derive its own members and options from evidence.
 *
 * `hypothesis` is the first, unverified estimate shown before the visible self-correction in a
 * simulated run. `finding` is the verified position with exactly three variants.
 */
window.REFERENCE_CASES = {
  "SC-CISCO-MA": {
    hypothesis: {
      label: "First estimate from the tip: linked accounts plus Meraki and Acacia",
      agreement_id: "RA-CISCO", members: ["10001", "10002", "10003", "10004"]
    },
    finding: {
      label: "Cisco group per the register: linked accounts plus Meraki, Acacia and Splunk",
      agreement_id: "RA-CISCO", members: ["10001", "10002", "10003", "10004", "10005"],
      variants: [
        { variant_id: "V1", name: "Claim the agreement year and link the three accounts", actions: [
          { type: "claim", years: ["AY"], start_in_days: 3 },
          { type: "link_accounts", vendor_ids: ["10003", "10004", "10005"] }
        ] },
        { variant_id: "V2", name: "Set off against open Cisco invoices and link the accounts", actions: [
          { type: "set_off", years: ["AY"], start_in_days: 3 },
          { type: "link_accounts", vendor_ids: ["10003", "10004", "10005"] }
        ] },
        { variant_id: "V3", name: "Claim the agreement year only", actions: [
          { type: "claim", years: ["AY"], start_in_days: 3 }
        ] }
      ]
    }
  },

  "SC-MSFT-PY": {
    hypothesis: {
      label: "First estimate: this agreement year, Microsoft Deutschland plus Activision",
      agreement_id: "RA-MSFT", members: ["20001", "20002"], years: ["AY"]
    },
    finding: {
      label: "Microsoft group per the register, all years: the look-back clause reaches the previous year",
      agreement_id: "RA-MSFT", members: ["20001", "20002"],
      variants: [
        { variant_id: "V1", name: "Claim the previous year under the look-back clause", actions: [
          { type: "claim", years: ["PY"], start_in_days: 10 }
        ] },
        { variant_id: "V2", name: "Hand the look-back claim to a recovery-audit firm", actions: [
          { type: "recovery_audit", years: ["PY"], start_in_days: 0 }
        ] },
        { variant_id: "V3", name: "Claim the previous year and link Activision", actions: [
          { type: "claim", years: ["PY"], start_in_days: 10 },
          { type: "link_accounts", vendor_ids: ["20002"] }
        ] }
      ]
    }
  },

  "SC-APEX-NAME": {
    hypothesis: {
      label: "What-if from the duplicate check: both Apex accounts as one supplier",
      agreement_id: "RA-APEX", members: ["40001", "40002"], what_if: true
    },
    finding: {
      label: "Apex Robotics Solutions alone (the register puts the look-alike in another group)",
      agreement_id: "RA-APEX", members: ["40001"],
      variants: [
        { variant_id: "V1", name: "Claim the 1.5 % bonus and fix the report threshold", actions: [
          { type: "claim", years: ["AY"], start_in_days: 2 },
          { type: "fix_report", all_tiers: true }
        ] },
        { variant_id: "V2", name: "Set off the bonus and fix the report threshold", actions: [
          { type: "set_off", years: ["AY"], start_in_days: 2 },
          { type: "fix_report", all_tiers: true }
        ] },
        { variant_id: "V3", name: "Claim the 1.5 % bonus only", actions: [
          { type: "claim", years: ["AY"], start_in_days: 2 }
        ] }
      ]
    }
  },

  "SC-AVGO-VMW": {
    hypothesis: {
      label: "First estimate from the question: linked accounts plus VMware International",
      agreement_id: "RA-AVGO", members: ["50001", "50002", "50003"]
    },
    finding: {
      label: "Broadcom group per the register: linked accounts plus both VMware accounts",
      agreement_id: "RA-AVGO", members: ["50001", "50002", "50003", "50004"],
      variants: [
        { variant_id: "V1", name: "Claim the statement difference and link both VMware accounts", actions: [
          { type: "claim", years: ["AY"], start_in_days: 3 },
          { type: "link_accounts", vendor_ids: ["50003", "50004"] }
        ] },
        { variant_id: "V2", name: "Claim the statement difference only", actions: [
          { type: "claim", years: ["AY"], start_in_days: 3 }
        ] },
        { variant_id: "V3", name: "Link both VMware accounts only", actions: [
          { type: "link_accounts", vendor_ids: ["50003", "50004"] }
        ] }
      ]
    }
  },

  "SC-SCHN-AVEVA": {
    hypothesis: {
      label: "First estimate: central purchases only (Schneider Electric GmbH and AVEVA), UK left out",
      agreement_id: "RA-SCHN", members: ["60001", "60003"]
    },
    finding: {
      label: "Schneider group per the register, all company codes: GmbH, Ltd and AVEVA",
      agreement_id: "RA-SCHN", members: ["60001", "60002", "60003"],
      variants: [
        { variant_id: "V1", name: "Claim this week and link AVEVA", actions: [
          { type: "claim", years: ["AY"], start_in_days: 3 },
          { type: "link_accounts", vendor_ids: ["60003"] }
        ] },
        { variant_id: "V2", name: "Set off this week and link AVEVA", actions: [
          { type: "set_off", years: ["AY"], start_in_days: 3 },
          { type: "link_accounts", vendor_ids: ["60003"] }
        ] },
        { variant_id: "V3", name: "Recovery-audit firm and link AVEVA", actions: [
          { type: "recovery_audit", years: ["AY"], start_in_days: 0 },
          { type: "link_accounts", vendor_ids: ["60003"] }
        ] }
      ]
    }
  },

  "SC-CRM-FX": {
    hypothesis: {
      label: "First estimate from the observation: the three linked accounts, pounds at the contract rate",
      agreement_id: "RA-CRM", members: ["70001", "70002", "70003"]
    },
    finding: {
      label: "Salesforce group per the register at the contract rate: four accounts including Tableau",
      agreement_id: "RA-CRM", members: ["70001", "70002", "70003", "70004"],
      variants: [
        { variant_id: "V1", name: "Claim, link Tableau and fix the report's currency rule", actions: [
          { type: "claim", years: ["AY"], start_in_days: 3 },
          { type: "link_accounts", vendor_ids: ["70004"] },
          { type: "fix_report", all_currencies: true }
        ] },
        { variant_id: "V2", name: "Claim and fix the currency rule only", actions: [
          { type: "claim", years: ["AY"], start_in_days: 3 },
          { type: "fix_report", all_currencies: true }
        ] },
        { variant_id: "V3", name: "Claim and link Tableau only", actions: [
          { type: "claim", years: ["AY"], start_in_days: 3 },
          { type: "link_accounts", vendor_ids: ["70004"] }
        ] }
      ]
    }
  }
};
