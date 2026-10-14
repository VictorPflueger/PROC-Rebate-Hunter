// Open-data fixtures for the browser tests: GLEIF, Wikidata and Frankfurter answer in the shape of the
// real services (TECH_NOTES §6), with representative values, so the browser-side parsers, the
// Diagnostics probes and the page's connection policy are exercised without the internet.

export const LEI = { splunk: "549300XGDSGBP6UEI867", cisco: "549300LKFJ962MZ46593", acacia: "549300PZLTIVLKOBPB61" };
export const WD = { splunk: "Q9000001", cisco: "Q9000002" };   // test ids, not real Wikidata items
export const OPEN_HOSTS = ["api.gleif.org", "www.wikidata.org", "api.frankfurter.dev"];

const leiRecord = (lei, name, city, country, status = "ACTIVE", registration = "ISSUED") => ({
  type: "lei-records", id: lei,
  attributes: {
    lei,
    entity: { legalName: { name, language: "en" }, legalAddress: { city, country }, headquartersAddress: { city, country }, status },
    registration: { status: registration }
  }
});
const RECORDS = {
  [LEI.splunk]: leiRecord(LEI.splunk, "SPLUNK LLC", "WILMINGTON", "US"),
  [LEI.cisco]: leiRecord(LEI.cisco, "CISCO SYSTEMS, INC.", "WILMINGTON", "US"),
  [LEI.acacia]: leiRecord(LEI.acacia, "Acacia Communications, Inc.", "Wilmington", "US", "ACTIVE", "LAPSED")
};
const notFound = { errors: [{ status: "404", title: "Not Found" }] };

/** { status, body } for an open-data request, or null when the host is not an open-data source. */
export function openDataFixture(url) {
  const u = new URL(url);
  const json = (body, status = 200) => ({ status, body });
  if (u.host === "api.gleif.org") {
    const m = u.pathname.match(/^\/api\/v1\/lei-records\/([A-Z0-9]{20})(\/ultimate-parent(-relationship)?)?$/);
    if (m) {
      const [, lei, parent, rel] = m;
      if (!RECORDS[lei]) return json(notFound, 404);
      if (!parent) return json({ data: RECORDS[lei] });
      if (lei !== LEI.splunk) return json(notFound, 404); // no parent reported (reporting exception)
      if (!rel) return json({ data: RECORDS[LEI.cisco] });
      return json({ data: { type: "relationship-records", id: `${LEI.splunk}-${LEI.cisco}`, attributes: { relationship: {
        startNode: { id: LEI.splunk, type: "LEI" }, endNode: { id: LEI.cisco, type: "LEI" },
        type: "IS_ULTIMATELY_CONSOLIDATED_BY", status: "ACTIVE",
        periods: [
          { startDate: "2024-03-18T00:00:00Z", endDate: null, type: "RELATIONSHIP_PERIOD" },
          { startDate: "2024-03-18T00:00:00Z", endDate: "2024-07-27T00:00:00Z", type: "ACCOUNTING_PERIOD" }
        ] } } } });
    }
    if (u.pathname === "/api/v1/lei-records" && /splunk/i.test(u.searchParams.get("filter[fulltext]") || "")) {
      return json({ data: [RECORDS[LEI.splunk]], meta: { pagination: { total: 1 } } });
    }
    return json({ data: [], meta: { pagination: { total: 0 } } });
  }
  if (u.host === "www.wikidata.org") {
    const action = u.searchParams.get("action");
    if (action === "wbsearchentities") {
      const q = u.searchParams.get("search") || "";
      if (/splunk/i.test(q)) return json({ search: [{ id: WD.splunk, label: "Splunk", description: "software company" }] });
      if (/cisco/i.test(q)) return json({ search: [{ id: WD.cisco, label: "Cisco", description: "networking company" }] });
      return json({ search: [] });
    }
    if (action === "wbgetentities") {
      const ids = (u.searchParams.get("ids") || "").split("|");
      if ((u.searchParams.get("props") || "").includes("claims")) {
        const since = { P580: [{ datavalue: { value: { time: "+2024-03-18T00:00:00Z" } } }] };
        return json({ entities: { [WD.splunk]: {
          labels: { en: { value: "Splunk" } }, descriptions: { en: { value: "software company" } },
          claims: {
            P127: [{ mainsnak: { datavalue: { value: { id: WD.cisco } } }, qualifiers: since }],
            P749: [{ mainsnak: { datavalue: { value: { id: WD.cisco } } }, qualifiers: since }],
            P1278: [{ mainsnak: { datavalue: { value: LEI.splunk } } }]
          }
        } } });
      }
      return json({ entities: Object.fromEntries(ids.map((id) => [id, { labels: { en: { value: id === WD.cisco ? "Cisco" : id } } }])) });
    }
    return json({ error: { code: "badrequest" } }, 400);
  }
  if (u.host === "api.frankfurter.dev") {
    const cur = u.searchParams.get("symbols") || "GBP";
    return json({ amount: 1, base: "EUR", date: "2026-10-13", rates: { [cur]: cur === "GBP" ? 0.8712 : 1.1032 } });
  }
  return null;
}
