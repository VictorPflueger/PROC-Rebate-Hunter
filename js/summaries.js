// One-line, human-readable summaries of tool results for the agent console. Shared by the live
// tool executor and the simulation player so both read the same; every tool has its own line, so a
// live result is never reduced to "Result received".

import { eurCompact, shortDate } from "./format.js";

export function summarizeToolResult(name, result) {
  if (!result) return "No result";
  if (result.error) return `Error: ${result.error}`;
  if (result.ok === false && Array.isArray(result.errors)) return `Rejected by the engine: ${result.errors[0]}`;
  switch (name) {
    case "erp_get_overview": {
      const vm = result.vendor_master || {};
      return `${result.company_codes?.length || 0} company codes, ${result.agreements?.length || 0} rebate agreements, ${vm.accounts} vendor accounts (${vm.with_group_key} with a group key), ${vm.register_entries} register entries`;
    }
    case "erp_get_agreement": {
      const ay = (result.years || []).find((y) => y.year === "AY");
      const tiers = (result.tiers || []).map((t) => `${t.rate_pct} % from ${eurCompact(t.from_eur)}`).join(", ");
      return `${result.title}: ${tiers}; ${result.linked_accounts?.length || 0} linked account${result.linked_accounts?.length === 1 ? "" : "s"}; agreement-year claims due by ${ay ? shortDate(ay.claim_deadline_day) : "—"}${result.look_back_days ? `; look-back ${result.look_back_days} days` : ""}`;
    }
    case "erp_list_vendors": {
      const ids = (result.vendors || []).map((v) => v.id);
      return `${result.count} account${result.count === 1 ? "" : "s"}${ids.length ? `: ${ids.slice(0, 5).join(", ")}${ids.length > 5 ? ` +${result.count - 5} more` : ""}` : ""}`;
    }
    case "erp_get_vendor":
      return `${result.name} (${result.city}, ${result.country}): ${money(result.spend?.last_year, result.invoice_currency)} last year; group key ${result.group_key || "none"}; ${result.linked_agreements?.length ? `linked to ${result.linked_agreements.join(", ")}` : "not linked to any agreement"}`;
    case "erp_get_spend": {
      const parts = Object.entries(result.totals_by_currency || {}).map(([c, v]) => money(v, c));
      return `${result.accounts?.length || 0} account${result.accounts?.length === 1 ? "" : "s"}: ${parts.join(" + ") || "no spend"} last agreement year`;
    }
    case "erp_find_duplicates": {
      const c = result.candidates || [];
      const top = c[0];
      const missed = result.register_members_below_rule?.length || 0;
      return `${c.length} look-alike candidate${c.length === 1 ? "" : "s"}${top ? `; closest ${top.vendor_id} at ${top.name_similarity_pct} % (${top.register})` : ""}${missed ? `; a name rule would miss ${missed} register member${missed === 1 ? "" : "s"}` : ""}`;
    }
    case "erp_family_tree": {
      if (!result.group) return result.register || "No register entry";
      const acquired = (result.members || []).filter((m) => m.relation === "acquired");
      const unlinked = (result.members || []).filter((m) => !m.group_key);
      return `${result.group.name}: ${result.members.length} member account${result.members.length === 1 ? "" : "s"}${acquired.length ? `, ${acquired.length} acquired` : ""}; ${unlinked.length ? `${unlinked.length} without group key` : "all with group key"}`;
    }
    case "erp_get_rebate_report": {
      const ay = (result.runs || []).find((r) => r.year === "AY");
      return ay ? `Year-end report (AY): counted ${ay.accounts_counted.length} account${ay.accounts_counted.length === 1 ? "" : "s"}, ${eurCompact(ay.counted_spend_eur)}; listed ${ay.listed.startsWith("yes") ? "yes" : "no"}; ${ay.claim_filed}` : "Report received";
    }
    case "open_gleif_search": {
      if (result.found === false) return `No GLEIF record for ${result.lei}`;
      const r = result.records || [];
      return r.length ? `${result.total ?? r.length} GLEIF record${(result.total ?? r.length) === 1 ? "" : "s"}; first: ${r[0].legal_name} (${r[0].lei}, ${r[0].registration_status || "status unknown"})` : `No GLEIF record matches "${result.query}"`;
    }
    case "open_gleif_parent": {
      if (result.found === false) return `No GLEIF record for ${result.lei}`;
      if (!result.ultimate_parent) return `${result.entity?.legal_name}: no ultimate parent reported to GLEIF`;
      return `${result.entity?.legal_name} is ultimately consolidated by ${result.ultimate_parent.legal_name} (GLEIF${result.relationship?.period_start ? `; relationship reported from ${result.relationship.period_start}` : ""})`;
    }
    case "open_wikidata_owner": {
      if (result.found === false) return `No Wikidata item for "${result.query}"`;
      const owner = [...(result.owned_by || []), ...(result.parent_organization || [])][0];
      return `${result.item?.label}: ${owner ? `owned by ${owner.name}${owner.since ? ` since ${owner.since}` : ""}` : "no owner recorded"} (Wikidata, unverified)`;
    }
    case "open_ecb_rate":
      return `ECB reference rate${result.date ? ` of ${result.date}` : ""}: 1 ${result.currency} = €${result.eur_per_unit}${result.contract_rates?.length ? `; contract rate ${result.contract_rates.map((c) => `€${c.eur_per_unit} (${c.agreement_id})`).join(", ")}` : ""}`;
    case "sim_rebate": {
      const b = result.baseline || {};
      const what = result.basis === "what_if" ? " (what-if, unverified)" : result.basis === "partial" ? " (partial count: linked accounts left out)" : "";
      const atRisk = b.rebate_at_risk_eur ?? b.value_at_risk_eur;
      const loss = b.first_loss_day === null || b.first_loss_day === undefined ? "nothing open within the horizon" : `first claim deadline on day ${b.first_loss_day} (${b.first_loss_year})`;
      return `Rebate at risk ${eurCompact(atRisk)}${what} over ${result.horizon_days} days; ${loss}${b.lost_already_eur ? `; ${eurCompact(b.lost_already_eur)} already lost` : ""}${result.variants?.length ? `; ${result.variants.length} options costed` : ""}`;
    }
    default:
      if (typeof result.summary === "string") return result.summary;
      return "Result received";
  }
}

function money(v, cur = "EUR") {
  if (v === null || v === undefined) return "—";
  return cur === "EUR" ? eurCompact(v) : `${cur} ${eurCompact(v).replace("€", "")}`;
}
