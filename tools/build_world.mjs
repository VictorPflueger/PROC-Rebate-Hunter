// Builds data/world.js, the synthetic company of the Rebate Hunter (developer tool; the app itself
// needs no build step and loads the generated file).
// Usage from the repository root:  node tools/build_world.mjs
//
// What it combines:
//   - the 150 vendor accounts and 1,203 purchase orders of the Streamlit version, regenerated bit for
//     bit from Python's random module with seed 1337 (tools/legacy_seed.mjs), then placed on the map
//     (a noise account takes its city's country), dated inside the agreement year, and given a
//     checksum-invalid tax id where the Streamlit one happened to be valid;
//   - 11 accounts added for scenarios 4 to 6 (Broadcom, Schneider Electric and Salesforce groups) and
//     two clean agreements for the live sweep;
//   - GlobalCorp SE's company codes, the corporate groups, the subscription register (family trees)
//     and the rebate agreements, written out below.
// Every euro figure is invented. Group names, LEIs and acquisition dates are real public facts,
// verified on 14 October 2026 (DATA_SOURCES.md §3.3). Tax ids are invented and cannot be real: the
// VAT numbers fail their check digit and US ids start with 00, which the IRS never issues.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { legacyData, PyRandom, round2 } from "./legacy_seed.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---- places -------------------------------------------------------------------------------------
// City → [lat, lon, ISO country]. Filler accounts in the Streamlit data drew their country at random,
// independently of the city ("Paris, AT"); the map needs one place, so the city's country wins.
const CITY = {
  Frankfurt: [50.11, 8.68, "DE"], Stuttgart: [48.78, 9.18, "DE"], Hamburg: [53.55, 9.99, "DE"],
  Berlin: [52.52, 13.40, "DE"], "Düsseldorf": [51.23, 6.78, "DE"], Paris: [48.86, 2.35, "FR"],
  Zurich: [47.37, 8.54, "CH"], Vienna: [48.21, 16.37, "AT"], Milan: [45.46, 9.19, "IT"],
  Madrid: [40.42, -3.70, "ES"], Amsterdam: [52.37, 4.90, "NL"],
  Bonn: [50.73, 7.10, "DE"], "San Jose": [37.34, -121.89, "US"], London: [51.51, -0.13, "GB"],
  Maynard: [42.43, -71.45, "US"], Munich: [48.14, 11.58, "DE"], Ismaning: [48.23, 11.68, "DE"],
  Manchester: [53.48, -2.24, "GB"], Bracknell: [51.41, -0.75, "GB"], Ballincollig: [51.89, -8.59, "IE"],
  "Palo Alto": [37.44, -122.14, "US"], Ratingen: [51.30, 6.85, "DE"], Telford: [52.68, -2.45, "GB"],
  Cambridge: [52.21, 0.12, "GB"], Dublin: [53.35, -6.26, "IE"]
};

const STEM_CATEGORY = {
  Logistics: "Logistics services", Facility: "Facility management", Consulting: "Consulting",
  MRO: "MRO supplies", Packaging: "Packaging", "IT-Services": "IT services", Robotics: "Automation and robotics",
  Chemicals: "Chemicals", Security: "Security services", Fleet: "Fleet services"
};

// ---- GlobalCorp SE: company codes (the buying entities; drawn like the Navigator's sites) ---------
const COMPANY_CODES = [
  { id: "CC-1000", code: "1000", name: "GlobalCorp SE", short: "Frankfurt", city: "Frankfurt am Main", country: "DE", lat: 50.11, lon: 8.68, currency: "EUR", role: "Group headquarters and central procurement; global IT and software contracts" },
  { id: "CC-2000", code: "2000", name: "GlobalCorp UK Ltd", short: "Birmingham", city: "Birmingham", country: "GB", lat: 52.49, lon: -1.89, currency: "GBP", role: "UK operations; invoices in pounds sterling and euros" },
  { id: "CC-3000", code: "3000", name: "GlobalCorp France SAS", short: "Lyon", city: "Lyon", country: "FR", lat: 45.76, lon: 4.84, currency: "EUR", role: "French operations" }
];

// ---- corporate groups (ultimate parents). LEIs as published by GLEIF; the city is the operational ---
// headquarters (GLEIF lists the legal address, which for US groups is a registered agent's city).
const GROUPS = [
  { id: "G-CISCO", name: "Cisco Systems, Inc.", short: "Cisco", lei: "549300LKFJ962MZ46593", city: "San Jose", country: "US", lat: 37.41, lon: -121.95, real: true },
  { id: "G-MSFT", name: "Microsoft Corporation", short: "Microsoft", lei: "INR2EJN1ERAN0W5ZP974", city: "Redmond", country: "US", lat: 47.64, lon: -122.13, real: true },
  { id: "G-AVGO", name: "Broadcom Inc.", short: "Broadcom", lei: "549300WV6GIDOZJTV909", city: "Palo Alto", country: "US", lat: 37.40, lon: -122.14, real: true },
  { id: "G-SCHN", name: "Schneider Electric SE", short: "Schneider Electric", lei: "969500A1YF1XUYYXS284", city: "Rueil-Malmaison", country: "FR", lat: 48.88, lon: 2.18, real: true },
  { id: "G-CRM", name: "Salesforce, Inc.", short: "Salesforce", lei: "RCGZFPDMRW58VJ54VR07", city: "San Francisco", country: "US", lat: 37.79, lon: -122.40, real: true },
  { id: "G-APEX-DE", name: "Apex Robotics Holding AG", short: "Apex Holding (DE)", lei: null, city: "Esslingen", country: "DE", lat: 48.74, lon: 9.31, real: false },
  { id: "G-APEX-GB", name: "Apex Industrial Group plc", short: "Apex Industrial (GB)", lei: null, city: "Leeds", country: "GB", lat: 53.80, lon: -1.55, real: false }
];

// ---- accounts added for scenarios 4 to 6 (AY = last agreement year, PY = the year before) --------
// `cc` overrides the company code where central procurement buys a software licence globally.
const EXTRA_VENDORS = [
  { id: "50001", name: "Broadcom Inc.", city: "San Jose", tax: "US000480482", ay: 7800000, py: 7200000, cat: "Semiconductors and infrastructure software" },
  { id: "50002", name: "Broadcom Europe Ltd", city: "Bracknell", tax: "GB284106577", ay: 4600000, py: 4700000, cat: "Infrastructure software (CA, Symantec)" },
  { id: "50003", name: "VMware International Unlimited Co.", city: "Ballincollig", tax: "IE9758133E", ay: 14900000, py: 13600000, cat: "Virtualisation software" },
  { id: "50004", name: "VMware Global Inc.", city: "Palo Alto", tax: "US003292913", ay: 5100000, py: 4600000, cat: "Virtualisation software" },
  { id: "60001", name: "Schneider Electric GmbH", city: "Ratingen", tax: "DE119297364", ay: 11200000, py: 9900000, cat: "Electrical equipment" },
  { id: "60002", name: "Schneider Electric Ltd", city: "Telford", tax: "GB232403213", ay: 2900000, py: 2600000, cat: "Electrical equipment" },
  { id: "60003", name: "AVEVA Solutions Ltd", city: "Cambridge", tax: "GB650180212", ay: 3400000, py: 2400000, cat: "Industrial software", cc: "CC-1000" },
  { id: "70001", name: "salesforce.com Germany GmbH", city: "Munich", tax: "DE814584192", ay: 13400000, py: 12100000, cat: "CRM software" },
  { id: "70002", name: "Slack Technologies Ltd", city: "Dublin", tax: "IE3460318OH", ay: 3900000, py: 3500000, cat: "Collaboration software" },
  { id: "70003", name: "Salesforce UK Ltd", city: "London", tax: "GB781902251", ay: 4600000, py: 4100000, currency: "GBP", cat: "CRM software" },
  { id: "70004", name: "Tableau Software UK", city: "London", tax: "GB173458016", ay: 1700000, py: 1600000, currency: "GBP", cat: "Analytics software" }
];

// Storyline accounts: category, prior-year spend and open payables (current unpaid invoices).
const CORE_DETAILS = {
  "10001": { cat: "Network equipment", py: 17300000 }, "10002": { cat: "Network equipment", py: 13600000 },
  "10003": { cat: "Cloud-managed networking", py: 9100000 }, "10004": { cat: "Optical interconnect", py: 5400000 },
  "10005": { cat: "Observability software", py: 3800000 },
  "20001": { cat: "Software licences and cloud", py: 43600000 }, "20002": { cat: "Software (games and training)", py: 7400000 },
  "40001": { cat: "Automation and robotics", py: 1800000 }, "40002": { cat: "Automation and robotics", py: 1700000 }
};
const OPEN_PAYABLES = {
  "10001": 1900000, "10002": 1300000, "10003": 700000, "10004": 400000, "10005": 300000,
  "20001": 3100000, "20002": 400000, "40001": 210000, "40002": 160000,
  "50001": 600000, "50002": 380000, "50003": 1150000, "50004": 420000,
  "60001": 900000, "60002": 210000, "60003": 280000,
  "70001": 1050000, "70002": 300000, "70003": 360000, "70004": 140000
};

// ---- subscription register: corporate family trees matched to the vendor master ------------------
// Synthetic, like a commercial family-tree service. Parent LEIs, legal-entity LEIs where given and
// acquisition dates are real (DATA_SOURCES.md §3.3). It is the only merge authority: similar names,
// the same city or the same category never merge accounts.
const REGISTER = [
  { vendor: "10001", group: "G-CISCO", relation: "subsidiary", legal: "Cisco Systems GmbH (Germany)", lei: null, since: null, evidence: "Wholly owned Cisco subsidiary" },
  { vendor: "10002", group: "G-CISCO", relation: "subsidiary", legal: "Cisco Technology, Inc.", lei: null, since: null, evidence: "Wholly owned Cisco subsidiary" },
  { vendor: "10003", group: "G-CISCO", relation: "acquired", legal: "Meraki (Cisco Meraki)", lei: null, since: "2012-12-20", evidence: "Cisco completed the acquisition of Meraki on 20 December 2012; no LEI of its own" },
  { vendor: "10004", group: "G-CISCO", relation: "acquired", legal: "Acacia Communications, Inc.", lei: "549300PZLTIVLKOBPB61", since: "2021-03-01", evidence: "Cisco completed the acquisition of Acacia Communications on 1 March 2021" },
  { vendor: "10005", group: "G-CISCO", relation: "acquired", legal: "Splunk LLC", lei: "549300XGDSGBP6UEI867", since: "2024-03-18", evidence: "Cisco completed the acquisition of Splunk on 18 March 2024" },
  { vendor: "20001", group: "G-MSFT", relation: "subsidiary", legal: "Microsoft Deutschland GmbH", lei: null, since: null, evidence: "Wholly owned Microsoft subsidiary" },
  { vendor: "20002", group: "G-MSFT", relation: "acquired", legal: "Activision Blizzard, Inc.", lei: "549300TPQQDBP9GNOF40", since: "2023-10-13", evidence: "Microsoft completed the acquisition of Activision Blizzard on 13 October 2023" },
  { vendor: "40001", group: "G-APEX-DE", relation: "subsidiary", legal: "Apex Robotics Solutions GmbH", lei: null, since: null, evidence: "Register: independent German group (fictional)" },
  { vendor: "40002", group: "G-APEX-GB", relation: "subsidiary", legal: "Apex Robotics Systems Ltd.", lei: null, since: null, evidence: "Register: a different British group, no link to 40001 (fictional)" },
  { vendor: "50001", group: "G-AVGO", relation: "parent entity", legal: "Broadcom Inc.", lei: "549300WV6GIDOZJTV909", since: null, evidence: "Invoices issued by the parent company" },
  { vendor: "50002", group: "G-AVGO", relation: "subsidiary", legal: "Broadcom Europe Ltd", lei: null, since: null, evidence: "Wholly owned Broadcom subsidiary" },
  { vendor: "50003", group: "G-AVGO", relation: "acquired", legal: "VMware International Unlimited Company", lei: "549300QDZDZP3SLIME17", since: "2023-11-22", evidence: "Broadcom completed the acquisition of VMware on 22 November 2023" },
  { vendor: "50004", group: "G-AVGO", relation: "acquired", legal: "VMware LLC", lei: "549300BUDHS3LRWBE814", since: "2023-11-22", evidence: "Broadcom completed the acquisition of VMware on 22 November 2023" },
  { vendor: "60001", group: "G-SCHN", relation: "subsidiary", legal: "Schneider Electric GmbH", lei: null, since: null, evidence: "Wholly owned Schneider Electric subsidiary" },
  { vendor: "60002", group: "G-SCHN", relation: "subsidiary", legal: "Schneider Electric Ltd", lei: null, since: null, evidence: "Wholly owned Schneider Electric subsidiary" },
  { vendor: "60003", group: "G-SCHN", relation: "acquired", legal: "AVEVA Solutions Limited", lei: "213800B9EV3SYDO3W459", since: "2018-03-01", evidence: "Schneider Electric has controlled AVEVA Group since 1 March 2018 (about 60 %) and completed the acquisition of the remaining shares on 18 January 2023" },
  { vendor: "70001", group: "G-CRM", relation: "subsidiary", legal: "salesforce.com Germany GmbH", lei: null, since: null, evidence: "Wholly owned Salesforce subsidiary" },
  { vendor: "70002", group: "G-CRM", relation: "acquired", legal: "Slack Technologies, Inc.", lei: "549300VIZRB02KN4IJ45", since: "2021-07-21", evidence: "Salesforce completed the acquisition of Slack Technologies on 21 July 2021" },
  { vendor: "70003", group: "G-CRM", relation: "subsidiary", legal: "Salesforce UK Ltd", lei: null, since: null, evidence: "Wholly owned Salesforce subsidiary" },
  { vendor: "70004", group: "G-CRM", relation: "acquired", legal: "Tableau Software UK Limited", lei: "549300R6ACJWLD7ZNT90", since: "2019-08-01", evidence: "Salesforce acquired Tableau Software in August 2019; the UK entity's LEI is retired" }
];

// ---- rebate agreements --------------------------------------------------------------------------
// ay_end_day: the last agreement year (AY) ended that many days before today (day 0). Claims for
// the AY must reach the supplier within claim_window_days of its end. lookback_days: an audit or
// correction clause that lets the year before (PY) be claimed this long after its end (0 = none).
// credited_basis "linked": the supplier's own statement already credits the rebate the linked
// accounts earn on their own; "none": nothing is paid without a written claim.
const AGREEMENTS = [
  {
    id: "RA-CISCO", group_key: "CISCO", group: "G-CISCO", short: "Cisco", title: "Cisco volume rebate agreement",
    counterparty: "Cisco Systems, Inc. and its Affiliates",
    clause: "§ 4.2 If GlobalCorp's net purchases from Cisco Systems, Inc. and its Affiliates in an agreement year reach €50.0m, Cisco credits 2 % of all net purchases of that year. Affiliates are entities controlled by Cisco Systems, Inc. at the time of invoice. § 4.5 Claims in writing within 90 days after the end of the agreement year. § 9.1 GlobalCorp may set off undisputed rebate amounts against open invoices.",
    tiers: [{ from_eur: 50000000, rate_pct: 2 }], retro: true,
    linked: ["10001", "10002"], ay_end_day: -59, claim_window_days: 90, lookback_days: 0,
    credited_basis: "none", report: { currencies: null }, set_off_allowed: true, credit_note_days: 45,
    claim_prep_days: 3, audit_prep_days: 10, cy_growth_pct: 4, fx_to_eur: {}
  },
  {
    id: "RA-MSFT", group_key: "MICROSOFT", group: "G-MSFT", short: "Microsoft", title: "Microsoft enterprise agreement, volume incentive",
    counterparty: "Microsoft Corporation and its Affiliates",
    clause: "§ 6.1 If GlobalCorp's purchases from Microsoft Corporation and its Affiliates in an agreement year reach €50.0m, Microsoft credits 2 % of all purchases of that year. § 6.4 Claims within 60 days after the end of the agreement year. § 11.3 Undisclosed rebates and corrections may be claimed within 15 months after the end of the agreement year. No set-off.",
    tiers: [{ from_eur: 50000000, rate_pct: 2 }], retro: true,
    linked: ["20001"], ay_end_day: -52, claim_window_days: 60, lookback_days: 456,
    credited_basis: "none", report: { currencies: null }, set_off_allowed: false, credit_note_days: 30,
    claim_prep_days: 3, audit_prep_days: 10, cy_growth_pct: 3, fx_to_eur: {}
  },
  {
    id: "RA-APEX", group_key: "APEX", group: "G-APEX-DE", short: "Apex", title: "Apex Robotics Solutions framework agreement, volume bonus",
    counterparty: "Apex Robotics Solutions GmbH and its affiliates",
    clause: "§ 5 Volume bonus on all purchases of an agreement year: 1.5 % from €2.0m, 3 % from €4.0m. Affiliates are companies controlled by Apex Robotics Holding AG. § 5.4 Claims within 80 days after the end of the agreement year. § 7 Set-off of undisputed amounts permitted.",
    tiers: [{ from_eur: 2000000, rate_pct: 1.5 }, { from_eur: 4000000, rate_pct: 3 }], retro: true,
    linked: ["40001"], ay_end_day: -68, claim_window_days: 80, lookback_days: 0,
    credited_basis: "none", report: { currencies: null, min_threshold_eur: 5000000 }, set_off_allowed: true, credit_note_days: 30,
    claim_prep_days: 2, audit_prep_days: 6, cy_growth_pct: 5, fx_to_eur: {}
  },
  {
    id: "RA-AVGO", group_key: "BROADCOM", group: "G-AVGO", short: "Broadcom", title: "Broadcom software and infrastructure rebate",
    counterparty: "Broadcom Inc. and its Affiliates",
    clause: "§ 3.1 Tiered rebate on all purchases of an agreement year from Broadcom Inc. and its Affiliates: 1 % from €10m, 2 % from €20m, 3 % from €30m; the tier reached applies to all purchases of the year. § 3.3 Broadcom credits the rebate shown in its own year-end statement for the accounts it has on record; differences must be claimed in writing within 60 days after the end of the agreement year, after which the statement is final. No set-off.",
    tiers: [{ from_eur: 10000000, rate_pct: 1 }, { from_eur: 20000000, rate_pct: 2 }, { from_eur: 30000000, rate_pct: 3 }], retro: true,
    linked: ["50001", "50002"], ay_end_day: -37, claim_window_days: 60, lookback_days: 0,
    credited_basis: "linked", report: { currencies: null }, set_off_allowed: false, credit_note_days: 45,
    claim_prep_days: 3, audit_prep_days: 10, cy_growth_pct: 6, fx_to_eur: {}
  },
  {
    id: "RA-SCHN", group_key: "SCHNEIDER", group: "G-SCHN", short: "Schneider Electric", title: "Schneider Electric framework agreement",
    counterparty: "Schneider Electric SE and its Affiliates",
    clause: "§ 4 If the purchases of GlobalCorp SE and its affiliated companies (all company codes) from Schneider Electric SE and its Affiliates in an agreement year reach €15.0m, Schneider Electric credits 2.5 % of all purchases of that year. § 4.6 Claims in writing within 90 days after the end of the agreement year; later claims are excluded. § 10 Set-off of undisputed amounts against open invoices of Schneider Electric SE and its Affiliates permitted.",
    tiers: [{ from_eur: 15000000, rate_pct: 2.5 }], retro: true,
    linked: ["60001", "60002"], ay_end_day: -81, claim_window_days: 90, lookback_days: 0,
    credited_basis: "none", report: { currencies: null }, set_off_allowed: true, credit_note_days: 30,
    claim_prep_days: 3, audit_prep_days: 10, cy_growth_pct: 4, fx_to_eur: {}
  },
  {
    id: "RA-CRM", group_key: "SALESFORCE", group: "G-CRM", short: "Salesforce", title: "Salesforce enterprise agreement, volume rebate",
    counterparty: "Salesforce, Inc. and its Affiliates",
    clause: "§ 7.1 If purchases from Salesforce, Inc. and its Affiliates in an agreement year reach €20.0m, Salesforce credits 3 % of all purchases of that year. § 7.2 Invoices in other currencies count at the fixed rates of Annex C (1 GBP = 1.17 EUR). § 7.5 Claims within 90 days after the end of the agreement year. § 12 Set-off of undisputed amounts permitted.",
    tiers: [{ from_eur: 20000000, rate_pct: 3 }], retro: true,
    linked: ["70001", "70002", "70003"], ay_end_day: -63, claim_window_days: 90, lookback_days: 0,
    credited_basis: "none", report: { currencies: ["EUR"] }, set_off_allowed: true, credit_note_days: 30,
    claim_prep_days: 3, audit_prep_days: 10, cy_growth_pct: 5, fx_to_eur: { GBP: 1.17 }
  },
  {
    id: "RA-CHROMA", group_key: "CHROMA", group: null, short: "Chroma Logistics", title: "Chroma Logistics transport framework, volume bonus",
    counterparty: "Chroma Logistics AG",
    clause: "§ 9 Volume bonus of 2 % of all freight purchases of an agreement year from €3.0m, credited automatically with the last invoice of the year.",
    tiers: [{ from_eur: 3000000, rate_pct: 2 }], retro: true,
    linked: ["30021"], ay_end_day: -40, claim_window_days: 60, lookback_days: 0,
    credited_basis: "linked", report: { currencies: null }, set_off_allowed: true, credit_note_days: 30,
    claim_prep_days: 2, audit_prep_days: 6, cy_growth_pct: 3, fx_to_eur: {}
  },
  {
    id: "RA-OMNI", group_key: "OMNI", group: null, short: "Omni Consulting", title: "Omni Consulting framework agreement, volume discount",
    counterparty: "Omni Consulting Ltd",
    clause: "§ 6 Volume discount of 1.5 % of all fees of an agreement year from €4.0m, on written claim within 90 days after the end of the agreement year.",
    tiers: [{ from_eur: 4000000, rate_pct: 1.5 }], retro: true,
    linked: ["30106"], ay_end_day: -75, claim_window_days: 90, lookback_days: 0,
    credited_basis: "none", report: { currencies: null }, set_off_allowed: false, credit_note_days: 30,
    claim_prep_days: 2, audit_prep_days: 6, cy_growth_pct: 2, fx_to_eur: {}
  }
];

// ---- helpers ------------------------------------------------------------------------------------
function hash(text) {
  let h = 2166136261;
  for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
const unit = (text) => hash(text) / 4294967296;

/** A stable offset around the city centre, so accounts in one city do not sit on one pixel. */
function jitter(id, lat, lon, maxDeg = 0.2) {
  const a = unit(`${id}:a`) * Math.PI * 2;
  const r = 0.035 + unit(`${id}:r`) * maxDeg;
  return [round(lat + r * Math.sin(a), 3), round(lon + (r * Math.cos(a)) / Math.cos((lat * Math.PI) / 180), 3)];
}
function round(x, d) { const f = 10 ** d; return Math.round(x * f) / f; }

/**
 * Places the k-th of n accounts of one city on a sunflower (golden-angle) disc around the centre,
 * so a city's dozen accounts read as a cluster of separate markers instead of one blob.
 */
function sunflower(k, n, lat, lon, radiusDeg, turn) {
  const r = radiusDeg * Math.sqrt((k + 0.5) / n);
  const a = turn + k * 2.399963; // golden angle in radians
  return [round(lat + r * Math.sin(a), 3), round(lon + (r * Math.cos(a)) / Math.cos((lat * Math.PI) / 180), 3)];
}

function companyCodeFor(country, currency) {
  if (currency === "GBP") return "CC-2000";
  if (country === "FR") return "CC-3000";
  if (country === "GB" || country === "IE") return country === "GB" ? "CC-2000" : "CC-1000";
  return "CC-1000";
}

function bankOf(id, country) {
  const iban = { DE: "DE", GB: "GB", US: "US", FR: "FR", CH: "CH", AT: "AT", IT: "IT", ES: "ES", NL: "NL", IE: "IE" }[country] || country;
  return { country: iban, last4: String(1000 + (hash(`${id}:bank`) % 9000)) };
}

// Streamlit tax ids that pass a real check (a valid German VAT check digit, US ids an IRS campus could
// issue) are replaced, so no invented account carries an id a real company might hold.
const TAX_ID_FIX = { "10002": "US007654321", "10004": "US002233445", "40001": "DE606060602" };

// The default agreement year for accounts without an agreement (the Cisco year).
const DEFAULT_AY_END = -59;

/** Spreads the Streamlit order dates (1 January to 28 May) across the agreement year, in order. */
function legacyDay(aedat, ayEnd) {
  const [, m, d] = aedat.split("-").map(Number);
  const doy = [0, 31, 59, 90, 120][m - 1] + d - 1; // 0 … 147
  const start = ayEnd - 364; // first day of the agreement year
  return start + Math.min(364, Math.floor((doy / 148) * 365));
}

// ---- build ----------------------------------------------------------------------------------------
const legacy = legacyData();
const agreementOf = new Map();
for (const a of AGREEMENTS) for (const id of [...a.linked, ...REGISTER.filter((r) => r.group === a.group).map((r) => r.vendor)]) if (!agreementOf.has(id)) agreementOf.set(id, a);

const vendors = [];
// The Streamlit app's noise accounts share a dozen cities; each city's accounts form one cluster.
const noiseByCity = new Map();
for (const v of legacy.vendors) {
  if (v.LIFNR in CORE_DETAILS) continue;
  if (!noiseByCity.has(v.ORT01)) noiseByCity.set(v.ORT01, []);
  noiseByCity.get(v.ORT01).push(v.LIFNR);
}
for (const list of noiseByCity.values()) list.sort();
for (const v of legacy.vendors) {
  const isCore = v.LIFNR in CORE_DETAILS;
  const [clat, clon, cityCountry] = CITY[v.ORT01];
  const country = isCore ? v.LAND1 : cityCountry;
  const peers = noiseByCity.get(v.ORT01) || [];
  const [lat, lon] = isCore
    ? jitter(v.LIFNR, clat, clon, 0.06)
    : sunflower(peers.indexOf(v.LIFNR), peers.length, clat, clon, 0.62, unit(`${v.ORT01}:turn`) * Math.PI * 2);
  const stem = isCore ? null : Object.keys(STEM_CATEGORY).find((s) => v.NAME1.includes(` ${s} `));
  const ay = v.SPEND_YTD;
  const pyFactor = 0.84 + unit(`${v.LIFNR}:py`) * 0.26;
  vendors.push({
    id: v.LIFNR, name: v.NAME1, city: v.ORT01, country, lat, lon, tax_id: TAX_ID_FIX[v.LIFNR] || v.STCD1, currency: "EUR",
    company_code: companyCodeFor(country, "EUR"),
    category: isCore ? CORE_DETAILS[v.LIFNR].cat : STEM_CATEGORY[stem],
    spend: { AY: ay, PY: isCore ? CORE_DETAILS[v.LIFNR].py : round2(ay * pyFactor) },
    open_payables_eur: OPEN_PAYABLES[v.LIFNR] ?? round2(ay * (0.04 + unit(`${v.LIFNR}:op`) * 0.05)),
    bank: bankOf(v.LIFNR, country),
    group_key: null,
    origin: isCore ? "storyline (Streamlit app)" : "noise (Streamlit app, seed 1337)"
  });
}
for (const x of EXTRA_VENDORS) {
  const [clat, clon, country] = CITY[x.city];
  const [lat, lon] = jitter(x.id, clat, clon, 0.06);
  const currency = x.currency || "EUR";
  vendors.push({
    id: x.id, name: x.name, city: x.city, country, lat, lon, tax_id: x.tax, currency,
    company_code: x.cc || companyCodeFor(country, currency), category: x.cat,
    spend: { AY: x.ay, PY: x.py }, open_payables_eur: OPEN_PAYABLES[x.id],
    bank: bankOf(x.id, country), group_key: null, origin: "scenario account (added)"
  });
}

// Vendor master group key (SAP LFA1-KONZS): set on the accounts linked to an agreement, empty on all
// others, the acquired companies' accounts included. That gap is what the scenarios are about.
for (const a of AGREEMENTS) for (const id of a.linked) {
  const v = vendors.find((x) => x.id === id);
  if (v) v.group_key = a.group_key;
}

// Purchase orders of the last agreement year: the Streamlit orders, plus orders for the added accounts
// (same splitting rule, separate seed 2026).
const vById = new Map(vendors.map((v) => [v.id, v]));
const orders = legacy.pos.map((p) => {
  const v = vById.get(p.LIFNR);
  const a = agreementOf.get(p.LIFNR);
  return { id: p.EBELN, vendor: p.LIFNR, company_code: v.company_code, day: legacyDay(p.AEDAT, a ? a.ay_end_day : DEFAULT_AY_END), value: p.NETWR, currency: v.currency };
});
const rnd = new PyRandom(2026);
let ebeln = 4500002001;
for (const x of EXTRA_VENDORS) {
  const v = vById.get(x.id);
  const a = agreementOf.get(x.id);
  const n = 6 + rnd.randint(0, 8);
  const target = Math.round(x.ay * 100);
  const cuts = [];
  for (let k = 0; k < n - 1; k++) cuts.push(rnd.randint(1, target - 1));
  cuts.sort((p, q) => p - q);
  const points = [0, ...cuts, target];
  const days = [];
  for (let k = 0; k < n; k++) days.push(a.ay_end_day - 364 + rnd.randint(0, 364));
  days.sort((p, q) => p - q);
  for (let k = 0; k < n; k++) {
    orders.push({ id: String(ebeln++), vendor: x.id, company_code: v.company_code, day: days[k], value: (points[k + 1] - points[k]) / 100, currency: v.currency });
  }
}

// ---- consistency of the build ------------------------------------------------------------------------
// The ledger is the truth: an account's agreement-year spend is the sum of its purchase orders. For
// seven noise accounts the Streamlit app's SPEND_YTD is one cent higher than its own orders, because
// app.py split int(SPEND_YTD * 100) cents and int() truncates 233585654.99999997 to 233585654. Those
// accounts take the order total and keep the Streamlit figure in legacy_spend_ytd.
const problems = [];
const sumBy = new Map();
for (const o of orders) sumBy.set(o.vendor, (sumBy.get(o.vendor) || 0) + Math.round(o.value * 100));
let centFixes = 0;
for (const v of vendors) {
  const cents = sumBy.get(v.id);
  const stated = Math.round(v.spend.AY * 100);
  if (cents === stated - 1 && v.origin.startsWith("noise")) {
    v.legacy_spend_ytd = v.spend.AY;
    v.spend.AY = cents / 100;
    centFixes += 1;
  } else if (cents !== stated) {
    problems.push(`${v.id}: orders ${cents} ≠ spend ${v.spend.AY}`);
  }
}
for (const o of orders) {
  const end = agreementOf.get(o.vendor)?.ay_end_day ?? DEFAULT_AY_END;
  if (o.day < end - 364 || o.day > end) problems.push(`${o.id}: day ${o.day} outside the agreement year ending on day ${end}`);
}
for (const r of REGISTER) if (!vById.has(r.vendor)) problems.push(`register: unknown vendor ${r.vendor}`);
for (const a of AGREEMENTS) for (const id of a.linked) if (!vById.has(id)) problems.push(`${a.id}: unknown linked vendor ${id}`);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}

const world = {
  meta: {
    company: "GlobalCorp SE",
    company_note: "GlobalCorp SE, its company codes, vendor accounts, spend figures and rebate agreements are fictional. The corporate groups (Cisco, Microsoft, Broadcom, Schneider Electric, Salesforce), their LEIs and their acquisitions are real, public facts. Apex Robotics and the noise vendors are fictional.",
    world_version: "1.1.0",
    currency: "EUR",
    legacy: "The first 150 vendor accounts and their 1,203 purchase orders are those of the Streamlit version (seed 1337), regenerated bit for bit by tools/legacy_seed.mjs.",
    default_ay_end_day: DEFAULT_AY_END,
    scope_note: "Every rebate agreement covers the purchases of GlobalCorp SE and its affiliated companies, i.e. all three company codes, unless its clause says otherwise.",
    report_note: "GlobalCorp's year-end rebate report counts only the vendor accounts linked to an agreement (group key), in the currencies the report is set up for, and lists an agreement only above its minimum threshold. A claim is filed only when the report shows one."
  },
  assumptions: {
    day_rate_eur: 1200,
    day_rate_note: "Blended cost of a person-day for a claim (procurement analyst and legal review): an assumption, not a market rate.",
    payment_run_days: 2,
    set_off_notice_days: 7,
    set_off_note: "Set-off covers undisputed amounts only (every set-off clause says so): the notice gives the supplier 7 days to object, then the next payment run settles it. The 7 days are an assumption.",
    set_off_admin_eur: 400,
    recovery_audit_fee_pct: 18,
    recovery_audit_days: 35,
    recovery_audit_note: "External recovery audit on contingency: typical fees are a percentage of the amount recovered; 18 % and 35 days are assumptions.",
    group_fix_base_eur: 6000,
    group_fix_per_account_eur: 2500,
    group_fix_days: 20,
    group_fix_note: "Maintain the corporate-group key (SAP vendor master field KONZS) on every member account, link the accounts to the agreement and add it to the year-end rebate report.",
    report_fix_eur: 4000,
    report_fix_days: 15,
    report_fix_note: "Change the rule of the year-end rebate report (count invoices in every currency at the contract rates, list every tier reached): a small change request to the reporting team; cost and lead time are assumptions."
  },
  company_codes: COMPANY_CODES,
  groups: GROUPS,
  vendors,
  register: REGISTER,
  agreements: AGREEMENTS,
  purchase_orders: orders
};

const header = `/*
 * REBATE HUNTER — synthetic world for the fictional client "GlobalCorp SE".
 * GENERATED by tools/build_world.mjs: do not edit by hand; change the generator and run
 * \`node tools/build_world.mjs\`.
 *
 * Invented: GlobalCorp SE, its company codes, every spend figure, purchase order and rebate
 * agreement, Apex Robotics and the noise vendors. Real: the corporate groups, their LEIs and their
 * acquisitions (DATA_SOURCES.md §3.3).
 *
 * Conventions
 *   - Day numbers are relative to the day the app is opened (day 0 = today; negative = past).
 *   - AY is an agreement's last agreement year (closed), PY the year before, CY the running year.
 *   - Spend is in the account's invoice currency; agreements convert at their own fixed rates.
 *   - The first 150 accounts and 1,203 orders are those of the Streamlit version (seed 1337).
 *
 * Loaded as a classic script so the app works without any same-origin fetch.
 */
`;
const out = `${header}window.WORLD = ${JSON.stringify(world)};\n`;
fs.writeFileSync(path.join(root, "data/world.js"), out);
console.log(`data/world.js: ${centFixes} accounts take their order total (one-cent truncation in app.py).`);
console.log(`data/world.js: ${vendors.length} vendor accounts, ${orders.length} purchase orders, ${AGREEMENTS.length} agreements, ${REGISTER.length} register entries (${Math.round(out.length / 1024)} KB).`);
