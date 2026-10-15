// Draft finalisation shared by both producers (live tools and the simulation player), so the safety
// lines can never differ between a live run and its replay: every draft carries the AI footer, and a
// posting draft also says that no ERP system is connected. The lines are added in code, after any
// truncation, so no draft can lose them.

export const DRAFT_TYPES = ["email", "posting", "memo"];
export const DRAFT_FOOTER = "Prepared with the Rebate Hunter AI assistant. Requires human approval before sending.";
export const MOCK_POSTING_LINE = "Mock posting for demonstration; no ERP system is connected.";
export const MAX_BODY = 5600;

/** The body as it goes into the Outbox: trimmed, with the mock line (postings) and the AI footer. */
export function finalizeDraft(type, body) {
  let out = String(body || "").trim().slice(0, MAX_BODY);
  if (type === "posting" && !/Mock posting/i.test(out)) out = `${out}\n\n${MOCK_POSTING_LINE}`;
  if (!out.includes("Requires human approval before sending")) out = `${out}\n\n${DRAFT_FOOTER}`;
  return out;
}
